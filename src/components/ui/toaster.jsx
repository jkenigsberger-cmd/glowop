import { useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

const AUTO_DISMISS_MS = 4000;

function ToastRow({ id, title, description, action, dismiss, ...props }) {
  useEffect(() => {
    const t = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [id, dismiss]);

  return (
    <Toast {...props}>
      <div className="grid gap-1">
        {title && <ToastTitle>{title}</ToastTitle>}
        {description && <ToastDescription>{description}</ToastDescription>}
      </div>
      {action}
      <ToastClose onClick={() => dismiss(id)} />
    </Toast>
  );
}

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, action, open, onOpenChange, ...props }) => (
        <ToastRow
          key={id}
          id={id}
          title={title}
          description={description}
          action={action}
          dismiss={dismiss}
          {...props}
        />
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}