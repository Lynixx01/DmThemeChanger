import fs from "fs";
import { builtinModules } from "module";
import archiver from "archiver";

const JSON_METADATA_PATH = "./metadata.json";
const LICENSE_PATH = "./LICENSE";
const OUT_DIR = "./out/";
const SCHEMAS_DIR_PATH = "./schemas/";

async function build() {
  // get metadata.json
  const data = fs.readFileSync(JSON_METADATA_PATH, "utf8");
  const metadata = JSON.parse(data);

  // Create extension package directory
  fs.mkdirSync(OUT_DIR + metadata.uuid, { recursive: true });
  fs.mkdirSync(OUT_DIR + metadata.uuid + "/schemas", { recursive: true });

  // SCHEMAS
  const files = fs.readdirSync(SCHEMAS_DIR_PATH);
  const schemas = files.find((file) => /\.compiled$/.test(file));

  // Check if schemas succesfully compiled
  if (!schemas)
    return console.error(
      "Schemas.compiled not found. Is the schemas successfully compiled?"
    );

  // Move schemas to extension package directory
  fs.copyFileSync(
    SCHEMAS_DIR_PATH + schemas,
    OUT_DIR + metadata.uuid + "/schemas/" + schemas
  );

  // Move everthing from src to extension package directory
  const src = fs.readdirSync("./src");

  for (const file of src) {
    fs.copyFileSync("./src/" + file, OUT_DIR + metadata.uuid + "/" + file);
  }

  // Copy metadata
  fs.copyFileSync(
    JSON_METADATA_PATH,
    OUT_DIR + metadata.uuid + "/metadata.json"
  );

  // Copy License
  fs.copyFileSync(LICENSE_PATH, OUT_DIR + metadata.uuid + "/LICENSE");

  zipFolder(OUT_DIR + metadata.uuid, metadata.uuid + ".zip");
}

function zipFolder(sourceFolder, outputFilePath) {
  const output = fs.createWriteStream(outputFilePath);
  const archive = archiver("zip", {
    zlib: { level: 9 }, // Sets the compression level.
  });

  output.on("close", function () {
    console.log(`${archive.pointer()} total bytes`);
    console.log("Zip file has been created successfully.");
  });

  archive.on("error", function (err) {
    throw err;
  });

  archive.pipe(output);

  archive.directory(sourceFolder, false);

  archive.finalize();
}

build();
