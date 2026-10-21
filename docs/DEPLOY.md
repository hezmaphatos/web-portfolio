# Deploy

Filled in during phase 10. Plan (spec §13): frontend on Vercel, backend on cPanel/Hostinger, two hostnames (e.g. `hackker.dev` and `api.hackker.dev`).

## Backend PHP limits (cPanel)

- `memory_limit` ≥ 256M: GD decodes an image to ~4–5 bytes per pixel; uploads are capped at 40 MP (`portfolio.media.max_pixels`), about 180 MB.
- `upload_max_filesize` ≥ 30M (videos), `post_max_size` ≥ 64M, `max_file_uploads` ≥ 20. The admin uploader should send large batches in several requests.
