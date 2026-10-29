declare module "swiper/react" {
  import { ReactNode } from "react";
  import type {
    AutoplayOptions,
    Pagination,
    PaginationOptions,
  } from "swiper";

  export interface SwiperProps {
    className?: string;
    modules?: unknown[];
    onSwiper?: (swiper: unknown) => void;
    onSlideChange?: () => void;
    autoplay?: AutoplayOptions;
    pagination?: PaginationOptions;
    loop?: boolean;
    spaceBetween?: number;
    slidesPerView?: number;
    breakpoints?: Record<number, { slidesPerView?: number }>;
    children?: ReactNode;
  }

  export class Swiper extends React.Component<SwiperProps, unknown> {
    static readonly modules: unknown[];
  }

  export interface SwiperSlideProps {
    children: ReactNode;
    className?: string;
    tag?: string;
  }

  export class SwiperSlide extends React.Component<SwiperSlideProps, unknown> {
    static readonly modules: unknown[];
  }
}