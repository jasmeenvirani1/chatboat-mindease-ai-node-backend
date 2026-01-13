const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Function to dynamically set destination directory
const getDestination = (destinationDir) => {
  return (req, file, cb) => {
    const uploadDir = `public/uploads/${destinationDir.toLowerCase()}`;
    // Check if the directory exists, if not, create it
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  };
};

const resolveFileNameConflict = (destinationDir, originalName) => {
  const ext = path.extname(originalName); // Get file extension
  const baseName = path.basename(originalName, ext); // Get the base name without extension
  let fileName = originalName;
  let counter = 1;

  // Check if a file with the same name already exists
  while (fs.existsSync(path.join(destinationDir, fileName))) {
    fileName = `${baseName}-${counter}${ext}`; // Append a number to the file name
    counter++;
  }

  return fileName;
};

// Multer disk storage configuration
const storage = (destinationDir) =>
  multer.diskStorage({
    destination: getDestination(destinationDir),
    // filename: function (req, file, cb) {
    //     cb(null, 'image' + '-' + Date.now() + path.extname(file.originalname));
    // }
    filename: (req, file, cb) => {
      const originalName = file.originalname;
      const finalFileName = resolveFileNameConflict(
        `public/uploads/${destinationDir.toLowerCase()}`,
        originalName
      );
      cb(null, finalFileName); // Set the final resolved file name
    },
  });

const singleupload = (destinationDir, fieldname) =>
  multer({
    storage: storage(destinationDir),
    limits: { fileSize: 1024 * 1024 * 40 }, // Set maximum file size (e.g., 10MB)
  }).single(fieldname || "image");

const multiupload = (destinationDir, fieldname) =>
  multer({
    storage: storage(destinationDir),
    limits: { fileSize: 1024 * 1024 * 40 }, // Set maximum file size (e.g., 10MB)
  }).array(fieldname || "image");

const threeuploads = (destinationDir) =>
  multer({
    storage: storage(destinationDir),
    limits: { fileSize: 1024 * 1024 * 40 }, // Set maximum file size (e.g., 10MB)
  }).fields([
    { name: "headerLogo", maxCount: 1 },
    { name: "footerLogo", maxCount: 1 },
    { name: "favicon", maxCount: 1 },
  ]);

const kycupload = (destinationDir) =>
  multer({
    storage: storage(destinationDir),
    limits: { fileSize: 1024 * 1024 * 40 }, // Set maximum file size (e.g., 40MB)
  }).fields([
    { name: "idProof", maxCount: 1 },
    { name: "addressProof", maxCount: 1 },
  ]);

const productupload = (destinationDir) =>
  multer({
    storage: storage(destinationDir),
    limits: { fileSize: 1024 * 1024 * 40 }, // Set maximum file size (e.g., 40MB)
  }).fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "photos", maxCount: 10 },
    { name: "video", maxCount: 1 },
  ]);


const blogmultiupload = (destinationDir, nestedFieldPattern) => {
  const [baseField, subField] = nestedFieldPattern.split(".*.");
  const fieldsConfig = [{ name: `${baseField}[0][${subField}]` }];

  // Dynamically add other fields based on expected content length
  for (let i = 1; i < 10; i++) {
    // assuming a maximum of 10 content items; adjust as needed
    fieldsConfig.push({ name: `${baseField}[${i}][${subField}]` });
  }

  return multer({
    storage: storage(destinationDir),
    limits: { fileSize: 1024 * 1024 * 40 }, // 40MB max file size
  }).fields(fieldsConfig);
};

module.exports = {
  singleupload,
  threeuploads,
  kycupload,
  multiupload,
  blogmultiupload,
  productupload,
};
