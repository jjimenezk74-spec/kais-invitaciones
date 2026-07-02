import { Label } from "@/components/ui/label";

type FieldProps = {
  label: string;
  children: React.ReactNode;
  hint?: string;
};

export function Field({ label, children, hint }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm leading-none">{label}</Label>
      {children}
      {hint ? <p className="text-[0.7rem] leading-tight text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
