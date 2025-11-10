import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folder = 'goprep';
    let resourceType = 'auto';
    
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      folder = 'goprep/documents';
      resourceType = 'raw';
    } else if (file.mimetype.startsWith('image/')) {
      folder = 'goprep/images';
      resourceType = 'image';
    }
    
    return {
      folder: folder,
      resource_type: resourceType,
      allowed_formats: resourceType === 'raw' ? ['docx', 'pdf'] : ['jpg', 'jpeg', 'png', 'webp'],
    };
  },
});

export const upload = multer({ storage: storage });
export default cloudinary;

