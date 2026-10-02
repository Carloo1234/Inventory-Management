import multer from "multer";
import { AppError } from "../../utils/AppError";
import { extensionForMimetype, MAX_UPLOAD_BYTES } from "../../utils/storage";

export const uploadSingleImage = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
    fileFilter: (_req, file, cb) => {
        if (extensionForMimetype(file.mimetype) === null) {
            cb(new AppError("Only JPEG, PNG, WebP or GIF images are allowed", 400));
            return;
        }
        cb(null, true);
    },
}).single("image");
