import type { LucideIcon, LucideProps } from "lucide-react";

export interface IconProps extends Omit<LucideProps, "ref"> {
  icon: LucideIcon;
}

export function Icon({ icon: LucideIconComp, strokeWidth = 1.7, size = 18, ...rest }: IconProps) {
  return <LucideIconComp strokeWidth={strokeWidth} size={size} {...rest} />;
}
