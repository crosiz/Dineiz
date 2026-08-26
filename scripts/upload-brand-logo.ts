import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

async function main() {
  const filePath = path.resolve(__dirname, '../packages/brand-assets/logos/dineiz-logo-light-bg.svg');
  const result = await cloudinary.uploader.upload(filePath, {
    folder: 'dineiz-branding',
    public_id: 'dineiz-logo-email',
    resource_type: 'image',
    overwrite: true,
  });
  console.log('SVG URL:', result.secure_url);

  // Retina PNG derivative for clients that don't render SVG in <img> well
  const pngUrl = cloudinary.url('dineiz-branding/dineiz-logo-email', {
    format: 'png',
    transformation: [{ width: 280, crop: 'scale' }, { quality: 'auto' }],
    secure: true,
  });
  console.log('PNG URL:', pngUrl);
}

main().catch((err) => {
  console.error('Upload failed:', err.message || err);
  process.exit(1);
});
