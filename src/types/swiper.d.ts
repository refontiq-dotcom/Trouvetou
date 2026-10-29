declare module "swiper/react" {
  import type { ComponentType, HTMLAttributes, ReactNode } from "react";
  import type { SwiperOptions } from "swiper/types";

  type SwiperProps = SwiperOptions & HTMLAttributes<HTMLDivElement> & {
    children?: ReactNode;
  };

  export const Swiper: ComponentType<SwiperProps>;
  export const SwiperSlide: ComponentType<HTMLAttributes<HTMLDivElement> & {
    children?: ReactNode;
  }>;
}
