import { type ReactNode } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { Button, type ButtonProps } from "@/components/ui/button";

type ActionType =
  | "create"
  | "save"
  | "edit"
  | "delete"
  | "assign"
  | "unassign"
  | "approve"
  | "reject"
  | "cancel"
  | "refresh"
  | "view"
  | "filter"
  | "status"
  | "invite"
  | "notify"
  | "copy";

type ActionMeta = {
  icon: string;
  label: string;
  variant?: ButtonProps["variant"];
};

const ACTION_META: Record<ActionType, ActionMeta> = {
  create: { icon: "fa-solid fa-plus", label: "Oluştur" },
  save: { icon: "fa-solid fa-floppy-disk", label: "Kaydet" },
  edit: { icon: "fa-solid fa-pen-to-square", label: "Düzenle", variant: "outline" },
  delete: { icon: "fa-solid fa-trash", label: "Sil", variant: "destructive" },
  assign: { icon: "fa-solid fa-link", label: "Ata", variant: "outline" },
  unassign: { icon: "fa-solid fa-link-slash", label: "Atamayı Kaldır", variant: "outline" },
  approve: { icon: "fa-solid fa-circle-check", label: "Onayla" },
  reject: { icon: "fa-solid fa-circle-xmark", label: "Reddet", variant: "outline" },
  cancel: { icon: "fa-solid fa-ban", label: "İptal", variant: "outline" },
  refresh: { icon: "fa-solid fa-rotate", label: "Listeyi Yenile", variant: "outline" },
  view: { icon: "fa-solid fa-eye", label: "Görüntüle", variant: "outline" },
  filter: { icon: "fa-solid fa-filter", label: "Filtrele", variant: "outline" },
  status: { icon: "fa-solid fa-toggle-on", label: "Durum", variant: "outline" },
  invite: { icon: "fa-solid fa-envelope", label: "Davet Oluştur" },
  notify: { icon: "fa-solid fa-bell", label: "Bildir", variant: "outline" },
  copy: { icon: "fa-solid fa-copy", label: "Kopyala", variant: "outline" },
};

export type ActionButtonProps = ButtonProps & {
  action: ActionType;
  label?: ReactNode;
  iconClassName?: string;
  iconOnly?: boolean;
  tooltip?: string;
  testID?: string;
};

export function ActionButton({
  action,
  label,
  iconClassName,
  variant,
  children,
  iconOnly = false,
  tooltip,
  className,
  testID,
  ...props
}: ActionButtonProps) {
  const meta = ACTION_META[action];
  const resolvedLabel = label ?? children ?? meta.label;
  const resolvedTooltip = tooltip || (typeof resolvedLabel === "string" ? resolvedLabel : meta.label);
  const ariaLabel = props["aria-label"] || (typeof resolvedLabel === "string" ? resolvedLabel : meta.label);

  if (iconOnly) {
    return (
      <span className="ui-icon-action inline-flex">
        <Button
          variant={variant ?? meta.variant}
          size={props.size ?? "icon"}
          className={className}
          aria-label={ariaLabel}
          title={resolvedTooltip}
          data-testid={testID}
          {...props}
        >
          <AppIcon icon={iconClassName || meta.icon} className="fa-soft" />
          <span className="sr-only">{resolvedLabel}</span>
        </Button>
        <span className="ui-tooltip">{resolvedTooltip}</span>
      </span>
    );
  }

  return (
    <Button variant={variant ?? meta.variant} className={className} aria-label={ariaLabel} data-testid={testID} {...props}>
      <AppIcon icon={iconClassName || meta.icon} className="fa-soft" />
      <span>{resolvedLabel}</span>
    </Button>
  );
}
