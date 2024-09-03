import GLib from "gi://GLib";
import Gio from "gi://Gio";

Gio._promisify(Gio.File.prototype, "enumerate_children_async");
Gio._promisify(Gio.FileEnumerator.prototype, "next_files_async");

const fn = (...args) => GLib.build_filenamev(args);

export function getDirs(type) {
  return [
    fn(GLib.get_home_dir(), "." + type),
    fn(GLib.get_user_data_dir(), type),
    ...GLib.get_system_data_dirs().map((dir) => fn(dir, type)),
  ];
}

export function getModeThemeDirs() {
  return GLib.get_system_data_dirs().map((dir) =>
    fn(dir, "gnome-shell", "theme")
  );
}

function isPathExist(path) {
  return GLib.access(path, 0) === 0;
}

async function getThemes(type) {
  const paths = [];
  await Promise.all(
    getDirs(type).map(async (dirName) => {
      const dir = Gio.File.new_for_path(dirName);
      (await readDir(dir)).forEach((name) => paths.push(fn(dirName, name)));
    })
  );
  return paths;
}

export async function collectAllThemes() {
  const DEFAULT = { name: "Adwaita (Default)", value: "Adwaita" };
  const themes = {
    cursor: [],
    icons: [],
    shell: [],
    gtk3: [
      { name: "HighContrast", value: "HighContrast" },
      { name: "HighContrastInverse", value: "HighContrastInverse" },
    ],
  };

  const themePaths = await getThemes("themes");
  const iconPaths = await getThemes("icons");

  for (const themepath of themePaths) {
    const value = themepath.split("/").pop();
    const name = value.charAt(0).toUpperCase() + value.slice(1);

    if (
      isPathExist(fn(themepath, "gtk-3.0", "gtk.css")) &&
      !themes.gtk3.some((e) => e.value === value)
    )
      themes.gtk3.push({ name, value });

    if (
      isPathExist(fn(themepath, "gnome-shell", "gnome-shell.css")) &&
      !themes.shell.some((e) => e.value === value)
    )
      themes.shell.push({ name, value });
  }

  for (const themepath of iconPaths) {
    const value = themepath.split("/").pop();
    const name = value.charAt(0).toUpperCase() + value.slice(1);

    if (
      isPathExist(fn(themepath, "cursors")) &&
      !themes.cursor.some((e) => e.value === value)
    )
      themes.cursor.push({ name, value });

    if (
      isPathExist(fn(themepath, "index.theme")) &&
      !themes.icons.some((e) => e.value === value)
    )
      themes.icons.push({ name, value });
  }

  for (const dirName of await getModeThemeDirs()) {
    const dir = Gio.File.new_for_path(dirName);
    for (const filename of await readDir(dir)) {
      if (!filename.endsWith(".css")) continue;

      const value = filename.slice(0, -4);
      const name = value.charAt(0).toUpperCase() + value.slice(1);
      themes.shell.push({ name, value });
    }
  }

  // Sort and add DEFAULT
  ["gtk3", "shell", "cursor", "icons"].forEach((type) => {
    themes[type].sort((a, b) => a.name.localeCompare(b.value));

    const isAdwaitaAlreadyExist = themes[type].find(
      (e) => e.name === "Adwaita"
    );

    if (isAdwaitaAlreadyExist) isAdwaitaAlreadyExist.name += " (Default)";
    else themes[type].unshift(DEFAULT);
  });

  return themes;
}

async function readDir(dir) {
  const fileInfos = [];
  let fileEnum;

  try {
    fileEnum = await dir.enumerate_children_async(
      Gio.FILE_ATTRIBUTE_STANDARD_NAME,
      Gio.FileQueryInfoFlags.NONE,
      GLib.PRIORITY_DEFAULT,
      null
    );
  } catch (e) {
    if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)) logError(e);
    return [];
  }

  let infos;
  do {
    infos = await fileEnum.next_files_async(100, GLib.PRIORITY_DEFAULT, null);
    fileInfos.push(...infos);
  } while (infos.length > 0);

  return fileInfos.map((info) => info.get_name());
}
