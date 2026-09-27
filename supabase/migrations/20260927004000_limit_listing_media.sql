-- Catalogue Trouvetou : garde-fou final sur la galerie publique.
-- Une annonce ne stocke jamais plus de 4 photos classiques.

UPDATE public.listings
SET images = (
  SELECT COALESCE(jsonb_agg(value), '[]'::jsonb)
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(images) = 'array' THEN images ELSE '[]'::jsonb END)
  WITH ORDINALITY AS t(value, ord)
  WHERE ord <= 4
)
WHERE jsonb_typeof(images) = 'array'
  AND jsonb_array_length(images) > 4;

ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_images_max_4;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_images_max_4
  CHECK (
    jsonb_typeof(images) = 'array'
    AND jsonb_array_length(images) <= 4
  );

COMMENT ON COLUMN public.listings.images IS
  'Galerie publique : 4 photos classiques maximum. Les visites 360 sont stockées séparément dans attributes.';
