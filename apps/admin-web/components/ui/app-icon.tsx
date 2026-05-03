import React, { cloneElement, isValidElement, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  BadgeInfo,
  Ban,
  Bell,
  BellOff,
  Bone,
  BookOpen,
  Boxes,
  CalendarDays,
  CheckCheck,
  CircleAlert,
  CircleSlash2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  ContactRound,
  Copy,
  CreditCard,
  Droplets,
  Dumbbell,
  Eye,
  FileText,
  Filter,
  Gift,
  Globe2,
  HeartPulse,
  House,
  IdCard,
  Inbox,
  Layers3,
  Link as LinkIcon,
  Mail,
  MailOpen,
  PackageOpen,
  Percent,
  PhoneCall,
  Plus,
  QrCode,
  RotateCw,
  Ruler,
  Save,
  Scale,
  Settings2,
  Shield,
  ShieldCheck,
  Signal,
  Sparkles,
  SquarePen,
  Stethoscope,
  Ticket,
  ToggleRight,
  Trash2,
  TriangleAlert,
  TrendingUp,
  Unlink,
  UserCheck,
  UserCog,
  UserMinus,
  UserPlus,
  UserRound,
  Users,
  Wallet,
  Waves,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, LucideIcon> = {
  "fa-address-card": ContactRound,
  "fa-arrow-trend-up": TrendingUp,
  "fa-arrow-up-right-from-square": ArrowUpRight,
  "fa-ban": Ban,
  "fa-bell": Bell,
  "fa-bell-slash": BellOff,
  "fa-bolt": Zap,
  "fa-bone": Bone,
  "fa-book": BookOpen,
  "fa-book-medical": BookOpen,
  "fa-book-open": BookOpen,
  "fa-box-open": PackageOpen,
  "fa-boxes-stacked": Boxes,
  "fa-calendar-check": CalendarDays,
  "fa-calendar-day": CalendarDays,
  "fa-calendar-days": CalendarDays,
  "fa-calendar-plus": CalendarDays,
  "fa-calendar-week": CalendarDays,
  "fa-chart-column": TrendingUp,
  "fa-chart-line": TrendingUp,
  "fa-circle-check": CheckCheck,
  "fa-circle-info": BadgeInfo,
  "fa-circle-xmark": CircleSlash2,
  "fa-clipboard-check": ClipboardCheck,
  "fa-clipboard-list": ClipboardList,
  "fa-clock": Clock3,
  "fa-clock-rotate-left": RotateCw,
  "fa-copy": Copy,
  "fa-credit-card": CreditCard,
  "fa-droplet": Droplets,
  "fa-dumbbell": Dumbbell,
  "fa-envelope": Mail,
  "fa-envelope-open-text": MailOpen,
  "fa-eye": Eye,
  "fa-file-signature": FileText,
  "fa-filter": Filter,
  "fa-filter-circle-dollar": Filter,
  "fa-floppy-disk": Save,
  "fa-gear": Settings2,
  "fa-gift": Gift,
  "fa-globe": Globe2,
  "fa-hand-holding-medical": ShieldCheck,
  "fa-heart-pulse": HeartPulse,
  "fa-hourglass-end": Clock3,
  "fa-hourglass-half": Clock3,
  "fa-house-medical": House,
  "fa-id-card": IdCard,
  "fa-inbox": Inbox,
  "fa-layer-group": Layers3,
  "fa-link": LinkIcon,
  "fa-link-slash": Unlink,
  "fa-money-bill": Wallet,
  "fa-money-bill-trend-up": TrendingUp,
  "fa-pen-to-square": SquarePen,
  "fa-people-group": Users,
  "fa-percent": Percent,
  "fa-phone-volume": PhoneCall,
  "fa-plus": Plus,
  "fa-qrcode": QrCode,
  "fa-rotate": RotateCw,
  "fa-ruler-combined": Ruler,
  "fa-ruler-vertical": Ruler,
  "fa-sack-dollar": Wallet,
  "fa-shield-halved": Shield,
  "fa-shield-heart": ShieldCheck,
  "fa-signal": Signal,
  "fa-sparkles": Sparkles,
  "fa-ticket": Ticket,
  "fa-toggle-on": ToggleRight,
  "fa-trash": Trash2,
  "fa-triangle-exclamation": TriangleAlert,
  "fa-user": UserRound,
  "fa-user-check": UserCheck,
  "fa-user-group": Users,
  "fa-user-nurse": Stethoscope,
  "fa-user-plus": UserPlus,
  "fa-user-slash": UserMinus,
  "fa-user-tie": UserCog,
  "fa-users": Users,
  "fa-users-viewfinder": Users,
  "fa-wallet": Wallet,
  "fa-wave-square": Waves,
  "fa-weight-scale": Scale,
};

function resolveLegacyIcon(className?: string) {
  if (!className) return CircleAlert;

  const iconToken = className
    .split(/\s+/)
    .find((token) => token.startsWith("fa-") && token !== "fa-solid" && token !== "fa-soft" && token !== "fa-chip");

  return (iconToken && ICON_MAP[iconToken]) || CircleAlert;
}

function stripLegacyIconClasses(className?: string) {
  if (!className) return "";

  return className
    .split(/\s+/)
    .filter((token) => token && !token.startsWith("fa-"))
    .join(" ");
}

export function AppIcon({
  icon,
  className,
  ...props
}: Omit<React.ComponentProps<"svg">, "ref"> & {
  icon: string;
}) {
  const Icon = resolveLegacyIcon(icon) as unknown as React.ElementType;
  return <Icon aria-hidden="true" className={cn("h-4 w-4 shrink-0", stripLegacyIconClasses(className || icon))} {...props} />;
}

export function renderLegacyIconNode(icon?: ReactNode) {
  if (!isValidElement(icon) || typeof icon.type !== "string" || icon.type !== "i") {
    return icon;
  }

  const className = typeof icon.props.className === "string" ? icon.props.className : "";
  return <AppIcon icon={className} className={className} />;
}

export function upgradeLegacyIconInElement(element: ReactNode, extraClassName?: string) {
  if (!isValidElement(element) || typeof element.type !== "string" || element.type !== "i") {
    return element;
  }

  const className = typeof element.props.className === "string" ? element.props.className : "";
  return <AppIcon icon={className} className={cn(className, extraClassName)} />;
}

export function withIconClass(element: ReactNode, className: string) {
  if (!isValidElement(element)) return element;

  return cloneElement(element, {
    className: cn("h-4 w-4 shrink-0", (element.props as { className?: string }).className, className),
    "aria-hidden": true,
  });
}
