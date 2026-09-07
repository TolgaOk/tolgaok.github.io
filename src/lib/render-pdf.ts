import { promises as fs } from "fs";
import { pdf } from "pdf-to-img";

function getPngDimensions(image: Buffer) {
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (image.length < 24 || !image.subarray(0, 8).equals(pngSignature)) {
    throw new Error("Expected pdf-to-img to return a PNG image");
  }

  return {
    width: image.readUInt32BE(16),
    height: image.readUInt32BE(20),
  };
}

export async function renderPDF(inputFilePath: string): Promise<ImageMetadata> {
  const inputFileName = inputFilePath.split("/").pop();
  const fullPath = `./src/pages/${inputFilePath}`;

  // Convert PDF to image with 4x scale (matching previous implementation)
  const document = await pdf(fullPath, {
    scale: 2,
  });

  // Get the first page
  const image = await document.getPage(1);

  const { width, height } = getPngDimensions(image);
  await document.destroy();

  // Ensure directories exist before writing the file
  const outputDir = `./dist/_astro`;
  await fs.mkdir("./dist", { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });

  // Write the image to disk
  await fs.writeFile(`${outputDir}/${inputFileName}.png`, image);

  let src: string;

  // If running astro build, env.PROD is true
  if (import.meta.env.PROD) {
    src = `_astro/${inputFileName}.png`;
  } else {
    src = `../dist/_astro/${inputFileName}.png`;
  }

  return {
    src: src,
    width: width,
    height: height,
    format: "png",
  };
}
