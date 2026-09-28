-- Portada de cada post (imagen de Multimedia para Open Graph y datos estructurados).
-- Ejecutar una vez en phpMyAdmin (pestaña SQL) sobre la base de datos del blog.
-- Es seguro repetirlo: no hace nada si la columna ya existe.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS cover_image VARCHAR(200) NULL AFTER excerpt;
