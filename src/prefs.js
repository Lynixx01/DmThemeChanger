import GObject from "gi://GObject";
import Gio from "gi://Gio";
import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import GLib from "gi://GLib";
import Gdk from "gi://Gdk";

import { collectAllThemes } from "./utils.js";

import {
  ExtensionPreferences,
  gettext as _,
} from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

export default class DmThemeChangerRebornPrefs extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    this._settings = this.getSettings();

    const themesPage = new Adw.PreferencesPage({
      title: _("Themes & Commands"),
      icon_name: "preferences-desktop-theme-symbolic",
    });
    window.add(themesPage);

    const wallpapersPage = new Adw.PreferencesPage({
      title: _("Wallpapers"),
      icon_name: "folder-pictures-symbolic",
    });
    window.add(wallpapersPage);

    collectAllThemes().then((themes) => {
      this._themes = themes;

      themesPage.add(this._lightModeGroup());
      themesPage.add(this._darkModeGroup());
      themesPage.add(this._otherGroup());
      themesPage.add(this._customCommandsGroup());

      this._setupWallpapersPage(wallpapersPage, window);
    });

    window.connect("close-request", () => {
      this._settings = null;
      this._themes = null;
    });
  }

  _lightModeGroup() {
    const group = new Adw.PreferencesGroup({
      title: _("Light Mode"),
      description: _("Configure the theme settings for light mode."),
    });

    const cursorDropDown = buildDropDown({
      title: _("Cursor"),
      items: this._themes.cursor,
      selected: this._settings.get_string("cursor-theme-light"),
      bind: [this._settings, "cursor-theme-light"],
    });

    const iconsDropDown = buildDropDown({
      title: _("Icons"),
      items: this._themes.icons,
      selected: this._settings.get_string("icon-theme-light"),
      bind: [this._settings, "icon-theme-light"],
    });

    const shellDropDown = buildDropDown({
      title: _("Shell"),
      items: this._themes.shell,
      selected: this._settings.get_string("shell-theme-light"),
      bind: [this._settings, "shell-theme-light"],
    });

    const gtk3DropDown = buildDropDown({
      title: _("Legacy Applications"),
      items: this._themes.gtk3,
      selected: this._settings.get_string("gtk3-theme-light"),
      bind: [this._settings, "gtk3-theme-light"],
    });

    group.add(cursorDropDown);
    group.add(iconsDropDown);
    group.add(shellDropDown);
    group.add(gtk3DropDown);
    return group;
  }

  _darkModeGroup() {
    const group = new Adw.PreferencesGroup({
      title: _("Dark Mode"),
      description: _("Configure the theme settings for dark mode."),
    });

    const cursorDropDown = buildDropDown({
      title: _("Cursor"),
      items: this._themes.cursor,
      selected: this._settings.get_string("cursor-theme-dark"),
      bind: [this._settings, "cursor-theme-dark"],
    });

    const iconsDropDown = buildDropDown({
      title: _("Icons"),
      items: this._themes.icons,
      selected: this._settings.get_string("icon-theme-dark"),
      bind: [this._settings, "icon-theme-dark"],
    });

    const shellDropDown = buildDropDown({
      title: _("Shell"),
      items: this._themes.shell,
      selected: this._settings.get_string("shell-theme-dark"),
      bind: [this._settings, "shell-theme-dark"],
    });

    const gtk3DropDown = buildDropDown({
      title: _("Legacy Applications"),
      items: this._themes.gtk3,
      selected: this._settings.get_string("gtk3-theme-dark"),
      bind: [this._settings, "gtk3-theme-dark"],
    });

    group.add(cursorDropDown);
    group.add(iconsDropDown);
    group.add(shellDropDown);
    group.add(gtk3DropDown);
    return group;
  }

  _otherGroup() {
    const group = new Adw.PreferencesGroup({
      title: _("Other Settings"),
      description: _("Additional configuration options"),
    });

    const optimzeTransition = buildExpanderRow({
      title: _("Optimize Dark-Light Transition"),
      subtitle: _("Optimize animation when toggling between light and dark modes"),
      active: this._settings.get_boolean("optimize-darklight-switch-transition"),
      show_switch: true,
      bind: [this._settings, "optimize-darklight-switch-transition"],
    });

    const transitionDuration = buildSpinRow({
      title: _("Transition Duration (ms)"),
      value: this._settings.get_int("darklight-transition-duration"),
      bind: [this._settings, "darklight-transition-duration"],
    });

    const clickDelay = buildSpinRow({
      title: _("Click Delay (ms)"),
      value: this._settings.get_int("darkmode-toggle-clickdelay"),
      bind: [this._settings, "darkmode-toggle-clickdelay"],
    });

    optimzeTransition.add_row(transitionDuration);
    optimzeTransition.add_row(clickDelay);
    group.add(optimzeTransition);

    const showIndicator = buildSwitchRow({
      title: _("Show System Bar Icon"),
      subtitle: _("Show a shortcut icon in the top system panel to easily toggle themes and open settings"),
      active: this._settings.get_boolean("show-indicator"),
      bind: [this._settings, "show-indicator"],
    });
    group.add(showIndicator);

    const toggleShortcut = buildShortcutRow({
      title: _("Keyboard Shortcut"),
      subtitle: _("Customize the keyboard shortcut to quickly toggle the theme"),
      bind: [this._settings, "toggle-theme-shortcut"],
    });
    group.add(toggleShortcut);

    return group;
  }

  _customCommandsGroup() {
    const group = new Adw.PreferencesGroup({
      title: _("Custom Commands"),
      description: _("Run custom shell commands when the theme switches. Perfect for syncing terminal, VS Code, Discord, or other application themes."),
    });

    const runCommandsSwitch = buildExpanderRow({
      title: _("Enable Custom Commands"),
      subtitle: _("Execute custom shell commands on theme changes"),
      active: this._settings.get_boolean("run-custom-commands"),
      show_switch: true,
      bind: [this._settings, "run-custom-commands"],
    });

    const lightCommandEntry = buildEntryRow({
      title: _("Light Mode Command"),
      bind: [this._settings, "custom-command-light"],
    });

    const darkCommandEntry = buildEntryRow({
      title: _("Dark Mode Command"),
      bind: [this._settings, "custom-command-dark"],
    });

    runCommandsSwitch.add_row(lightCommandEntry);
    runCommandsSwitch.add_row(darkCommandEntry);
    group.add(runCommandsSwitch);
    return group;
  }

  _setupWallpapersPage(page, window) {
    const bgSettings = new Gio.Settings({
      schema: "org.gnome.desktop.background",
    });

    // Group 1: Desktop Background
    const desktopGroup = new Adw.PreferencesGroup({
      title: _("Desktop Wallpaper"),
      description: _("Select separate custom wallpapers for light and dark modes."),
    });

    const lightDesktopRow = buildFileChooserRow({
      title: _("Light Mode Wallpaper"),
      bind: [bgSettings, "picture-uri"],
      window: window,
    });

    const darkDesktopRow = buildFileChooserRow({
      title: _("Dark Mode Wallpaper"),
      bind: [bgSettings, "picture-uri-dark"],
      window: window,
    });

    desktopGroup.add(lightDesktopRow);
    desktopGroup.add(darkDesktopRow);
    page.add(desktopGroup);

    // Group 2: Lockscreen Background
    const lockscreenGroup = new Adw.PreferencesGroup({
      title: _("Lockscreen Wallpaper"),
      description: _("Configure lockscreen wallpapers to sync with the theme."),
    });

    const syncLockscreenSwitch = buildExpanderRow({
      title: _("Sync Lockscreen Wallpaper"),
      subtitle: _("Automatically change lockscreen wallpaper on theme switch"),
      active: this._settings.get_boolean("sync-lockscreen-wallpaper"),
      show_switch: true,
      bind: [this._settings, "sync-lockscreen-wallpaper"],
    });

    const useDesktopWallpaperSwitch = buildSwitchRow({
      title: _("Use Desktop Wallpaper"),
      subtitle: _("Use the same wallpaper configured for the desktop on the lockscreen"),
      active: this._settings.get_boolean("lockscreen-use-desktop-wallpaper"),
      bind: [this._settings, "lockscreen-use-desktop-wallpaper"],
    });

    const lightLockscreenRow = buildFileChooserRow({
      title: _("Light Mode Lockscreen"),
      bind: [this._settings, "lockscreen-wallpaper-light"],
      window: window,
    });

    const darkLockscreenRow = buildFileChooserRow({
      title: _("Dark Mode Lockscreen"),
      bind: [this._settings, "lockscreen-wallpaper-dark"],
      window: window,
    });

    const updateSensitivity = () => {
      let useDesktop = this._settings.get_boolean("lockscreen-use-desktop-wallpaper");
      lightLockscreenRow.set_sensitive(!useDesktop);
      darkLockscreenRow.set_sensitive(!useDesktop);
    };
    this._settings.connect("changed::lockscreen-use-desktop-wallpaper", () => updateSensitivity());
    updateSensitivity();

    syncLockscreenSwitch.add_row(useDesktopWallpaperSwitch);
    syncLockscreenSwitch.add_row(lightLockscreenRow);
    syncLockscreenSwitch.add_row(darkLockscreenRow);
    lockscreenGroup.add(syncLockscreenSwitch);
    page.add(lockscreenGroup);
  }
}

export const DropdownItems = GObject.registerClass(
  {
    Properties: {
      name: GObject.ParamSpec.string("name", "name", "name", GObject.ParamFlags.READWRITE, null),
      value: GObject.ParamSpec.string(
        "value",
        "value",
        "value",
        GObject.ParamFlags.READWRITE,
        null
      ),
    },
  },
  class DropdownItems extends GObject.Object {
    _init(name, value) {
      super._init({ name, value });
    }
  }
);

function buildDropDown(
  opts = {
    title: "Untitled DropDown",
    subtitle: null,
    items: [],
    selected: null,
    bind: null,
  }
) {
  let liststore = new Gio.ListStore({ item_type: DropdownItems });
  for (const item of opts.items) {
    liststore.append(new DropdownItems(item.name, item.value));
  }

  let selected = null;
  for (let i = 0; i < liststore.get_n_items(); i++) {
    if (liststore.get_item(i).value === opts.selected) {
      selected = i;
      break;
    }
  }
  if (selected === null) selected = -1;

  const comboRow = new Adw.ComboRow({
    title: opts.title,
    subtitle: opts.subtitle || null,
    model: liststore,
    expression: new Gtk.PropertyExpression(DropdownItems, null, "name"),
    selected: selected,
  });

  if (opts.bind)
    comboRow.connect("notify::selected", () =>
      opts.bind[0].set_string(opts.bind[1], comboRow.selectedItem.value)
    );

  return comboRow;
}

function buildExpanderRow(
  opts = {
    title: "Untitled ExpanderRow",
    subtitle: null,
    show_switch: false,
    active: false,
    bind: null,
  }
) {
  const expanderRow = new Adw.ExpanderRow({
    title: opts.title,
    subtitle: opts.subtitle || null,
    show_enable_switch: opts.show_switch || false,
    enable_expansion: opts.active,
  });

  if (opts.bind)
    expanderRow.connect("notify::enable-expansion", () =>
      opts.bind[0].set_boolean(opts.bind[1], expanderRow.enable_expansion)
    );

  return expanderRow;
}

function buildSpinRow(
  opts = {
    title: "Untitled SpinRow",
    subtitle: null,
    step: 50,
    lower: 100,
    upper: 20000,
    value: false,
    bind: null,
  }
) {
  const adjustment = new Gtk.Adjustment({
    step_increment: opts.step || 50,
    lower: opts.lower || 100,
    upper: opts.upper || 20000,
    value: opts.value,
  });

  const spinRow = new Adw.SpinRow({
    title: opts.title,
    subtitle: opts.subtitle || null,
    adjustment,
  });

  if (opts.bind)
    opts.bind[0].bind(opts.bind[1], adjustment, "value", Gio.SettingsBindFlags.DEFAULT);

  return spinRow;
}

function buildEntryRow(
  opts = {
    title: "Untitled EntryRow",
    bind: null,
  }
) {
  const entryRow = new Adw.EntryRow({
    title: opts.title,
  });

  if (opts.bind)
    opts.bind[0].bind(opts.bind[1], entryRow, "text", Gio.SettingsBindFlags.DEFAULT);

  return entryRow;
}

function buildFileChooserRow(
  opts = {
    title: "Select File",
    bind: null,
    window: null,
  }
) {
  const row = new Adw.ActionRow({
    title: opts.title,
    subtitle: _("No file selected"),
  });

  const button = new Gtk.Button({
    icon_name: "document-open-symbolic",
    valign: Gtk.Align.CENTER,
  });
  row.add_suffix(button);

  const settings = opts.bind ? opts.bind[0] : null;
  const key = opts.bind ? opts.bind[1] : null;

  const updateSubtitle = () => {
    if (settings && key) {
      let val = settings.get_string(key);
      if (val && val.trim() !== "") {
        try {
          let displayPath = val.startsWith("file://")
            ? decodeURIComponent(val.substring(7))
            : val;
          row.set_subtitle(displayPath);
        } catch (e) {
          row.set_subtitle(val);
        }
      } else {
        row.set_subtitle(_("No file selected"));
      }
    }
  };

  updateSubtitle();

  if (settings && key) {
    settings.connect(`changed::${key}`, () => updateSubtitle());
  }

  button.connect("clicked", () => {
    const fileDialog = new Gtk.FileDialog({
      title: opts.title,
      modal: true,
    });

    const filter = new Gtk.FileFilter();
    filter.set_name(_("Images"));
    filter.add_mime_type("image/*");
    const filters = new Gio.ListStore({ item_type: Gtk.FileFilter });
    filters.append(filter);
    fileDialog.set_filters(filters);

    fileDialog.open(opts.window, null, (dialog, res) => {
      try {
        const file = dialog.open_finish(res);
        const uri = file.get_uri();
        if (settings && key) {
          settings.set_string(key, uri);
        }
      } catch (e) {
        // User cancelled or error
      }
    });
  });

  return row;
}

function buildSwitchRow(
  opts = {
    title: "Untitled SwitchRow",
    subtitle: null,
    active: false,
    bind: null,
  }
) {
  const switchRow = new Adw.SwitchRow({
    title: opts.title,
    subtitle: opts.subtitle || null,
    active: opts.active,
  });

  if (opts.bind)
    opts.bind[0].bind(opts.bind[1], switchRow, "active", Gio.SettingsBindFlags.DEFAULT);

  return switchRow;
}

function buildShortcutRow(
  opts = {
    title: "Keyboard Shortcut",
    subtitle: null,
    bind: null,
  }
) {
  const settings = opts.bind[0];
  const key = opts.bind[1];

  const row = new Adw.ActionRow({
    title: opts.title,
    subtitle: opts.subtitle || null,
  });

  const shortcutLabel = new Adw.ShortcutLabel({
    valign: Gtk.Align.CENTER,
  });

  const button = new Gtk.Button({
    valign: Gtk.Align.CENTER,
  });

  const clearButton = new Gtk.Button({
    icon_name: "edit-clear-symbolic",
    valign: Gtk.Align.CENTER,
    tooltip_text: _("Clear Shortcut"),
  });

  const box = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 6,
    valign: Gtk.Align.CENTER,
  });

  box.append(shortcutLabel);
  box.append(button);
  box.append(clearButton);
  row.add_suffix(box);

  const updateUI = () => {
    const shortcutArray = settings.get_strv(key);
    const shortcutStr = shortcutArray.length > 0 ? shortcutArray[0] : "";
    if (shortcutStr && shortcutStr !== "") {
      shortcutLabel.set_accelerator(shortcutStr);
      button.set_label(_("Edit"));
      clearButton.set_sensitive(true);
    } else {
      shortcutLabel.set_accelerator("");
      button.set_label(_("Set Shortcut"));
      clearButton.set_sensitive(false);
    }
  };

  updateUI();
  settings.connect(`changed::${key}`, () => updateUI());

  clearButton.connect("clicked", () => {
    settings.set_strv(key, []);
  });

  let controller = null;

  button.connect("clicked", () => {
    button.set_label(_("Press keys..."));
    button.set_sensitive(false);
    clearButton.set_sensitive(false);

    controller = Gtk.EventControllerKey.new();
    button.add_controller(controller);

    controller.connect("key-pressed", (ctrl, keyval, keycode, state) => {
      const mask = state & Gtk.accelerator_get_default_mod_mask();

      if (
        keyval === Gdk.KEY_Super_L || keyval === Gdk.KEY_Super_R ||
        keyval === Gdk.KEY_Control_L || keyval === Gdk.KEY_Control_R ||
        keyval === Gdk.KEY_Alt_L || keyval === Gdk.KEY_Alt_R ||
        keyval === Gdk.KEY_Shift_L || keyval === Gdk.KEY_Shift_R
      ) {
        return Gdk.EVENT_PROPAGATE;
      }

      const accelerator = Gtk.accelerator_name(keyval, mask);
      
      if (accelerator) {
        settings.set_strv(key, [accelerator]);
      }

      button.remove_controller(controller);
      controller = null;
      button.set_sensitive(true);
      updateUI();

      return Gdk.EVENT_STOP;
    });
  });

  return row;
}
