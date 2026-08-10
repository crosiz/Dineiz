import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { env } from '../env';

// Configure Cloudinary
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Uploads an image buffer to Cloudinary.
 * Files are organized by tenantId.
 * 
 * @param buffer - The image buffer to upload
 * @param tenantId - The ID of the tenant to organize images
 * @param folderType - E.g. 'menu', 'logos'
 * @returns The secure URL and public_id from Cloudinary
 */
export async function uploadImage(
  buffer: Buffer,
  tenantId: string,
  folderType: 'menu' | 'logos' = 'menu'
): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `${env.CLOUDINARY_FOLDER}/${tenantId}/${folderType}`,
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        if (!result) {
          return reject(new Error('No result from Cloudinary'));
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    // Write the buffer to the upload stream
    uploadStream.end(buffer);
  });
}

/**
 * Deletes an image from Cloudinary by its public ID.
 * 
 * @param publicId - The public ID of the image to delete
 */
export async function deleteImage(publicId: string): Promise<boolean> {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === 'ok';
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
    return false;
  }
}
