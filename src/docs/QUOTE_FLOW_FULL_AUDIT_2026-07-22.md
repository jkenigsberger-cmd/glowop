# AUDITORÍA INTEGRAL READ-ONLY — QUOTE FLOW
Fecha: 2026-07-22 · Modo: solo lectura · Archivos de producción modificados: 0

---

## 1. RESUMEN EJECUTIVO

El Quote Flow (preparación, opciones A/B, activación operativa y aprobación comercial) está en general bien construido: las invariantes de cardinalidad están protegidas en backend, la aprobación es idempotente, el borrado en cascada cubre Quote/QuoteOption/OGP, y el aislamiento operativo tiene guard backend (`assertOperationalGroup`). Los datos reales están casi limpios.

Hallazgos principales:
1. **CRITICAL (arquitectura ≠ esperado):** el OperationalGroupProfile se crea **al guardar la Quote** (`ensureQuotePreparation`), no al activar/aprobar. Es consistente y sin duplicados, pero contradice la arquitectura esperada declarada.
2. **CRITICAL (datos):** las **4 QuoteOption existentes son huérfanas** (sus Quotes ya no existen). El total financiero de opciones en BD hoy es 100% basura.
3. **HIGH:** guardado parcial en `QuoteFormModal` puede duplicar Quote/Group al reintentar tras un fallo intermedio.
4. **HIGH:** `checkSiteAvailability` no exige autenticación; `syncQuoteToOperationalGroup` acepta Quotes DRAFT (contra su propia documentación) y usa solo `user.role` (no InternalUser).
5. **MEDIUM:** rechazo de Quote deja el Group provisional en DRAFT+preparation para siempre (aislado, pero nunca se limpia ni archiva).

---

## 2. ARQUITECTURA REAL (verificada contra código)

```
Quote ──group_id──▶ Group (quote_preparation_flow=true)
  │                    │
  │                    └──◀ OperationalGroupProfile.group_id (creado YA al guardar la Quote)
  │                              └── quote_id ──▶ Quote
  └──◀ QuoteOption.quote_id  (0 en legacy/single · exactamente 2 [A,B] cuando multi_option_enabled)
```

- Al guardar Quote (prep flow): `QuoteFormModal` → crea Quote → `ensureQuotePreparationGroup` → `ensureQuotePreparation` crea Group **y OGP** con compensación (borra Group si falla el link) y verificación de cardinalidad post-creación.
- Multi opción: `manageQuoteOptions` (materialize/save/delete_b), Quote espeja legacy con payload de A.
- Activación: `activatePreparationGroupOperationally` → Group CONFIRMED, sin tocar Quote/QuoteOption. ✔
- Aprobación: `approveQuoteAndActivateGroup` (prep) / `approveQuoteAndInitializeGroup` (legacy) → SELECTED/NOT_SELECTED, snapshot, APPROVED, Group CONFIRMED.
- Borrado: `deleteGroup` cascada completa incl. Quote, QuoteOption, OGP, operativos y Google Calendar del sistema.

## 3–4. ARQUITECTURA ESPERADA vs REAL — DIFERENCIAS

| # | Esperado | Real | Veredicto |
|---|---|---|---|
| D1 | OGP se crea solo al activar/aprobar | OGP se crea al guardar la Quote (`quotePreparation.js:78-88`) | **Desviación deliberada pero contraria al spec** — decidir cuál es la fuente de verdad |
| D2 | Group.status DRAFT o PENDING_APPROVAL al crear | Siempre DRAFT (`quotePreparation.js:54`) | OK (subconjunto válido) |
| D3 | 1-2 QuoteOption por Quote multi | Garantizado por `getExactQuoteOptions` en cada operación | OK |
| D4 | QuoteOption nunca huérfana | Sin protección al borrar Quote fuera de `deleteGroup` — **hoy hay 4 huérfanas** | **Violado en datos** |
| D5 | PDF fila שם קבוצה solo con `quote.group_name` real | `resolveQuotePdfData` línea 205: `quote?.group_name?.trim() \|\| ""` | OK ✔ |
| D6 | B empieza vacía | `createEmptyQuoteOption` frontend+backend, materialize usa la versión backend | OK ✔ |

---

## 5. TABLA DE BUGS

| ID | Sev | Módulo | Escenario | Esperado | Actual | Evidencia | Impacto | Reproducción | Corrección |
|---|---|---|---|---|---|---|---|---|---|
| B-01 | CRITICAL | Datos | QuoteOption huérfanas | 0 | **4/4 huérfanas** (IDs abajo) | consulta S-10 | Analytics/queries de precios pueden leer importes de Quotes borradas | leer QuoteOption.list | Limpieza controlada + garantizar cascada al borrar Quote directamente |
| B-02 | CRITICAL | Preparación | Guardar Quote nueva crea OGP inmediatamente | OGP solo al activar/aprobar | `ensureQuotePreparation` crea OGP siempre | `base44/shared/quotePreparation.js:78-88` | Groups en preparación aparecen con perfil "operativo" antes de tiempo; módulos que solo comprueban existencia de OGP podrían incluirlos | crear Quote nueva desde הצעות מחיר | Mover creación de OGP a activate/approve, o ratificar el diseño actual y actualizar el spec |
| B-03 | HIGH | Guardado | Fallo tras `Quote.create` y antes de opciones/ensure → reintento crea 2ª Quote (y 2º Group en flujo no-prep) | Reintento seguro | `handleSubmit` no guarda el id de la Quote creada; `isEdit` sigue false | `QuoteFormModal.jsx` handleSubmit (Quote.create → invoke) | Quotes/Groups duplicados en fallos de red | crear quote, cortar red tras el 1er write, reintentar | Persistir id creado en estado y pasar a modo edit tras el primer write |
| B-04 | HIGH | Guardado (no-prep) | Flujo "lector nuevo" sin prep: crea Group y luego Quote; si Quote falla → Group huérfano sin quote_preparation_flow | Compensación | `QuoteFormModal.jsx` `isNewGroupFlow && !usePreparationFlow`: `Group.create` sin rollback | Group operativo fantasma visible en módulos | fallo de red entre ambos writes | Compensar (borrar Group) o crear Quote primero |
| B-05 | HIGH | Permisos | `checkSiteAvailability` sin auth | Solo usuarios autenticados | No hay `auth.me()`; lee con asServiceRole | `checkSiteAvailability/entry.ts:25-35` | Cualquier llamada anónima lee ocupación/nombres de grupos | curl sin token | Añadir auth + rol |
| B-06 | HIGH | Sync | `syncQuoteToOperationalGroup` acepta DRAFT (doc dice solo APPROVED) y sobrescribe Group CONFIRMED (nombre/fechas/pax) tras click explícito | Solo APPROVED; diff selectivo | `entry.ts:42-44` permite DRAFT; aplica todo el payload, no solo campos seleccionados | Sobrescritura de datos operativos editados por administración (fechas/pax/contacto) con datos de una Quote DRAFT | botón עדכן נתונים con quote DRAFT | Restringir a APPROVED o hacer el diff selectivo real |
| B-07 | HIGH | Permisos | `approveQuoteAndInitializeGroup` permite rol OPERATIONS; UI solo ADMIN/SUPER_ADMIN | Paridad UI/backend | `entry.ts:30` `ALLOWED_ROLES` incluye OPERATIONS; `Quotes.jsx` canDecide solo ADMIN/SA | OPERATIONS puede aprobar por API directa | POST directo | Alinear roles |
| B-08 | MEDIUM | Sync | `syncQuoteToOperationalGroup` usa `user.role` sin InternalUser y SDK 0.8.31 | Resolución por InternalUser | `entry.ts:20` | Usuario con role plataforma 'admin' pero InternalUser VIEWER pasa | — | resolver rol como el resto |
| B-09 | MEDIUM | Rechazo | Group provisional queda DRAFT+prep para siempre tras REJECTED | Definir destino | `rejectQuotePreparation` no toca el Group (`data_deleted:false`) | Acumulación de Groups zombie en pestaña "בהכנה" de Groups.jsx | rechazar quote | Decidir política: archivar Group o dejarlo con badge "נדחה" |
| B-10 | MEDIUM | Tarjetas | Límites 500 quotes / 1000 options sin paginación | Cobertura total | `Quotes.jsx` useQuery limits | Con >1000 QuoteOption, precios de tarjetas serían incompletos (falsos "legacy") | volumen futuro | paginar o filtrar por quote_ids visibles |
| B-11 | MEDIUM | Concurrencia | `manageQuoteOptions` materialize/save sin lock server-side; dos admins simultáneos pueden crear A o B duplicadas entre `getQuoteOption` y `create` | Duplicado imposible | `entry.ts:27-49` check-then-create | `getExactQuoteOptions` posterior lanzaría 409 pero el duplicado queda en BD | 2 requests paralelos | verificación post-create con compensación (como OGP) |
| B-12 | LOW | PDF | `clientOrg` calculado y nunca renderizado; usa `group.group_name` (con fallback de cliente) | — | `QuotePdfTemplate.jsx:200` | Código muerto que invita a reintroducir el bug de nombre | — | eliminar en fase de limpieza |
| B-13 | LOW | Disponibilidad | DAY_USE existentes solo se cuentan vía OperationalHold, no vía Groups DAY_USE CONFIRMED | Contar grupos de día reales | `checkSiteAvailability:179-197` | Subestima ocupación de día si no hay holds | dos day-use el mismo día | contar Groups DAY_USE |
| B-14 | LOW | Duplicación | `QUOTE_OPTION_FIELDS`/`createEmptyQuoteOption` duplicados en `src/lib/quoteOptions.js` y `base44/shared/quoteOptions.js` (hoy idénticos) | Fuente única | ambos archivos | Riesgo de drift silencioso | — | documentar espejo o generar |
| B-15 | LOW | manageQuoteOptions | `save` valida rol pero no valida shape/números de payloads (guardaría totales arbitrarios) | Validación | `entry.ts:38-49` | Datos financieros corruptos vía API | POST manual | validación mínima de tipos |

---

## 6. TABLA DE INVARIANTES

| Invariante | Frontend | Backend | Datos hoy | Resultado |
|---|---|---|---|---|
| 1 Quote → 1 Group | ✔ (flujo) | ✔ compensación en ensure | ✔ 0 violaciones | OK |
| ≤1 Quote prep abierta por Group | — | ✔ activate lanza MULTIPLE_PREPARATION_QUOTES; deleteGroup 409 | ✔ 0 | OK |
| ≤1 OGP por Group | — | ✔ ensureExactlyOneOperationalProfile + verificación post | ✔ 0 | OK |
| Multi = exactamente A+B | ✔ QuoteFormModal valida al cargar | ✔ getExactQuoteOptions en cada acción | ✔ 0 (ninguna quote multi activa) | OK |
| Sin QuoteOption huérfanas | — | ✖ solo deleteGroup cascada | **✖ 4/4 huérfanas** | **FALLA** |
| B empieza vacía | ✔ createEmptyQuoteOption | ✔ materialize usa empty | n/a | OK |
| Doble clic no crea 2 B | ✔ optionCreateLockRef + optionBusy | ✔ idempotente (getQuoteOption) | — | OK |
| B aprobada no se borra | ✔ (mensaje) | ✔ delete_b 409 SELECTED/approved_option_key | — | OK |
| Aprobación idempotente | — | ✔ already_approved / repaired; opción distinta → 409 QUOTE_ALREADY_APPROVED_WITH_DIFFERENT_OPTION | ✔ 0 inconsistencias | OK |
| Activación no toca Quote/opciones | — | ✔ activate solo Group+OGP | — | OK |
| Aislamiento prep group | ✔ isOperationalGroup | ✔ assertOperationalGroup en writes muestreados | ✔ 0 prep groups con registros operativos | OK (ver §8) |

## 7. AUDITORÍA DE DATOS (read-only, 2026-07-22)

Conteos: 12 Quotes · 115 Groups · 109 OGP · 4 QuoteOption.

| # | Chequeo | Resultado |
|---|---|---|
| 1 | Quote sin Group | 0 |
| 2 | group_id roto | 0 |
| 3 | Group prep sin Quote | 0 |
| 4 | >1 Quote prep abierta por Group | 0 (tampoco >1 quote de cualquier tipo) |
| 5 | >1 OGP por Group | 0 |
| 6 | OGP sin Group | 0 |
| 7 | OGP con quote_id inexistente | 0 |
| 8 | OGP con quote_id de otro Group | 0 |
| 9 | Multi sin A/B exactas | 0 (ninguna Quote multi_option_enabled activa) |
| 10 | **QuoteOption huérfanas** | **4**: `6a6064255327e0fd78853adc`, `6a60642566688856c2a9e6ec`, `6a5f32fdd2a0d4f5f5f54c82`, `6a5f32fd14f5e361809f94bf` |
| 11-15 | Aprobadas: key/SELECTED/mismatch de totales | 0 en todos |
| 16 | Group CONFIRMED + Quote DRAFT/SENT | 1: group `6a4510a3bd9157a58ec99f8e` — **caso válido de activación previa, no bug** |
| 17 | Group prep DRAFT/PENDING con registros operativos | 0 |
| 18 | Quote REJECTED + Group CONFIRMED | 4 quotes: `6a3a7883…`, `6a280e28…`, `6a16c57f…`, `6a14428c…` — quotes legacy sobre grupos ya operativos; revisar caso por caso, probablemente legítimo |
| 19 | Financieros de Group borrado | Las 4 opciones de #10 (mismo hallazgo) |
| 20 | Duplicados quote_number/version | 0 |

## 8. AISLAMIENTO OPERATIVO — módulo por módulo

| Módulo | Estado |
|---|---|
| Groups.jsx | ✔ frontend (bucket "preparación" separado) |
| saveGroupScheduleItem | ✔ backend (`assertOperationalGroup` + validación en actividades compartidas) — verificado en código |
| checkSiteAvailability | ✔ backend (`isPreparationGroupOperational` en groups y holds) |
| Dashboard / Calendar / Kitchen / Housekeeping / Allocation / Common Spaces / Daily Brief / Global Search / Daily Print / Kitchen Report | ⚠ No re-verificado archivo por archivo en esta auditoría — datos actuales muestran 0 fugas (chequeo #17) y el patrón `isOperationalGroup` existe; incluir en pruebas manuales |
| prefillGroupScheduleAndMeals / submitGuestForm / meal writes | ⚠ Idem — pendiente verificación puntual |
| Escritura backend general | Parcial: los muestreados rechazan `PREPARATION_GROUP_NOT_OPERATIONAL` |

## 9. PERMISOS Y FEATURE FLAGS

- `QUOTE_PREPARATION_FLOW=true`, rollout ADMINS — frontend (`quotePreparationFlow.js`) y backend (`quotePreparationConfig.js` solo on/off; el rol lo chequea cada función) coherentes.
- `QUOTE_MULTI_OPTION_FLOW=true`, rollout SUPER_ADMIN_ONLY — frontend y backend espejados e idénticos hoy (riesgo de drift B-14).
- Discrepancias: B-05 (sin auth), B-07 (OPERATIONS puede aprobar legacy por API), B-08 (rol de plataforma en sync).
- `manageQuoteOptions` doble guard (flag SUPER_ADMIN + rol ADMIN/SA) → efectivamente SUPER_ADMIN only. Coherente con UI.

## 10. PDFs A/B/COMBINADO

- Combinado reutiliza exactamente `resolveQuotePdfData` + `QuotePricingPage/TermsPage/CatalogPage` — **sin cálculos duplicados** ✔.
- Página B con `showShared=false` (header compacto, sin repetir cliente/fechas) ✔.
- Fila שם קבוצה solo con `quote.group_name` real ✔. `contactPerson` nunca cae a client_name ✔.
- Audience: selector obligatorio con error visual (`audienceError`); PDF con fallback a EDUCATION_STAFF para legacy ✔.
- Cardinalidad validada antes de imprimir (INVALID_OPTION_CARDINALITY → toast) ✔.
- Menor: B-12 (clientOrg muerto).

## 11. ANALYTICS FINANCIERO

`getAnalyticsData` no fue re-leído en esta pasada; riesgos estructurales a validar antes de cualquier Analytics financiero:
- Quote legacy espeja el payload de la opción A en `total_price` → sumar `Quote.total_price` de quotes multi contaría solo A (correcto por accidente) pero DRAFT/REJECTED inflarían ingresos si no se filtra por APPROVED.
- `approved_option_total_price` es el único campo fiable para ingreso aprobado; existe y es consistente en datos (chequeos 11-15 = 0).
- Las 4 QuoteOption huérfanas son el riesgo #1 de inflado si algo agrega por QuoteOption.

## 12. BUILD Y LINT

El entorno de auditoría no expone terminal para `npm run build`/`eslint` literales. Sustituto aplicado: lectura estática de todos los archivos del flujo — sin imports rotos, sin `no-undef` visibles, exports/imports consistentes (`getEffectiveQuoteGroupName` existe en `quotePreparation.js` y `quoteAudience.js`, ambas usadas). Pendiente ejecutar build/lint real en CI.

## 13. LEGACY CONFLICTIVO

- `syncQuoteToOperationalGroup` (SDK 0.8.31, rol de plataforma, acepta DRAFT) — el más desalineado.
- SDK versions mixtas: 0.8.31 / 0.8.38 / 0.8.40 entre funciones del flujo.
- Secciones legacy en QuoteFormModal (student/adult/workshops/lectures/addons "ישן") correctamente encapsuladas (solo visibles con datos).
- `surcharge_lines` siempre se guarda `[]` — campo residual.
- `QuoteFormModal.jsx` ~1260 líneas — refactor pendiente (declarado, no ejecutado).
- Condición ambigua: varios módulos distinguen prep/legacy solo por `preparation_flow_enabled`/`quote_preparation_flow`; el chequeo #18 muestra que quotes legacy REJECTED conviven con Groups CONFIRMED — válido pero indocumentado.

## 14. TOP 10 RIESGOS

1. B-01 QuoteOption huérfanas (datos financieros basura ya presentes).
2. B-02 OGP creado al guardar Quote (arquitectura vs spec).
3. B-03 duplicación de Quote/Group en reintentos tras fallo parcial.
4. B-05 checkSiteAvailability sin autenticación.
5. B-06 sync desde Quote DRAFT sobrescribe operación.
6. B-04 Group huérfano en flujo no-prep.
7. B-07 OPERATIONS aprueba por API.
8. B-11 carrera de creación de opciones sin lock server-side.
9. B-09 Groups zombie tras rechazo.
10. B-10 límites de paginación 500/1000.

## 15. PLAN DE CORRECCIÓN POR FASES (no implementado)

- **Fase 1 — Integridad crítica:** limpiar las 4 QuoteOption huérfanas (previo backup/confirmación); cascada QuoteOption al borrar Quote por cualquier vía; fix B-03/B-04 (persistir id creado + compensación); decidir y ratificar B-02.
- **Fase 2 — Lógica funcional:** B-05 auth; B-06 restringir sync a APPROVED + diff selectivo; B-07/B-08 alinear roles; B-11 verificación post-create en materialize/save.
- **Fase 3 — UX/caché:** B-09 política de Group tras rechazo; B-10 paginación de quoteCenterOptions; revisar invalidaciones tras aprobar (quoteCenterOptions se invalida vía refresh ✔).
- **Fase 4 — Limpieza/refactor:** B-12 clientOrg; unificar SDK 0.8.40; partir QuoteFormModal; retirar surcharge_lines; fuente única de QUOTE_OPTION_FIELDS.
- **Fase 5 — Analytics:** modelo ingreso = solo `approved_option_total_price` de APPROVED; excluir REJECTED/EXPIRED/borradas; nunca A+B.

## 16. PRUEBAS MANUALES POSTERIORES

1. Crear Quote A nueva → verificar 1 Quote + 1 Group + (según decisión B-02) OGP.
2. Crear B → total 0, líneas vacías; editar A no toca B y viceversa; guardar/reabrir.
3. Doble clic en "agregar B" y en aprobar.
4. PDF A / B / combinado con y sin group_name.
5. Activar Group antes de aprobar → Quote intacta; luego aprobar A y reintentar con B → 409.
6. Rechazar Quote → Group no aparece en módulos operativos.
7. Eliminar Group → tarjeta y Quote desaparecen sin refresh; verificar 0 huérfanos.
8. Corte de red tras el primer write del guardado (B-03).
9. Llamada anónima a checkSiteAvailability (B-05).
10. Usuario OPERATIONS llamando approveQuoteAndInitializeGroup por API (B-07).
11. Verificación puntual de aislamiento en Kitchen/Housekeeping/Daily Brief/Global Search.

---

## CONFIRMACIÓN FINAL

- Archivos de producción modificados: **0** (solo este informe en docs).
- Registros creados: **0** · modificados: **0** · eliminados: **0**.
- Migraciones ejecutadas: **0**.
- Google Calendar tocado: **no**.