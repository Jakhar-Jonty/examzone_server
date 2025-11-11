import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

// Configure Cloudinary
const cloudinaryConfig = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
};

// Validate configuration
if (!cloudinaryConfig.cloud_name || !cloudinaryConfig.api_key || !cloudinaryConfig.api_secret) {
  console.error('⚠️  Cloudinary configuration missing! Please check your .env file.');
  console.error('Required: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
  console.error('Current values:', {
    cloud_name: cloudinaryConfig.cloud_name ? '✓' : '✗',
    api_key: cloudinaryConfig.api_key ? '✓' : '✗',
    api_secret: cloudinaryConfig.api_secret ? '✓' : '✗',
  });
}

// Configure the cloudinary instance
cloudinary.config(cloudinaryConfig);

// Verify cloudinary is configured before creating storage
const currentConfig = cloudinary.config();
if (!currentConfig.cloud_name || !currentConfig.api_key || !currentConfig.api_secret) {
  console.error('❌ Cloudinary not properly configured!');
  console.error('Missing:', {
    cloud_name: !currentConfig.cloud_name,
    api_key: !currentConfig.api_key,
    api_secret: !currentConfig.api_secret,
  });
  console.error('Environment variables:', {
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ? '✓' : '✗',
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ? '✓' : '✗',
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ? '✓' : '✗',
  });
} else {
  console.log('✓ Cloudinary configured successfully:', currentConfig.cloud_name);
}

// Create storage with explicit config
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

export const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Export a function to verify Cloudinary config
export const verifyCloudinaryConfig = () => {
  const config = cloudinary.config();
  return {
    configured: !!(config.cloud_name && config.api_key && config.api_secret),
    cloud_name: config.cloud_name,
    has_api_key: !!config.api_key,
    has_api_secret: !!config.api_secret,
  };
};

export default cloudinary;

