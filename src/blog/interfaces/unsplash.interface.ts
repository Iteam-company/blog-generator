export interface UnsplashImage {
  id?: string;
  urls: {
    regular: string;
    small: string;
  };
  alt_description: string | null;
  description: string | null;
}
export interface UnsplashSearchResponse {
  results: UnsplashImage[];
}
