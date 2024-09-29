import Mtk from "gi://Mtk";
import GObject from "gi://GObject";
import Clutter from "gi://Clutter";

import GLib from "gi://GLib";

import * as Main from "resource:///org/gnome/shell/ui/main.js";

let TRANSITION_DURATION = 1000; // ms
let CLICK_DELAY = 3000; // ms

const DarkModeTransition = GObject.registerClass(
  class DarkModeTransition extends Clutter.Actor {
    _init() {
      super._init({ visible: false });
    }

    vfunc_hide() {
      this.content = null;
      super.vfunc_hide();
    }

    cloneSceenAndDisplay() {
      // if (this.visible) return;

      Main.uiGroup.set_child_above_sibling(this, null);

      const rect = new Mtk.Rectangle({
        x: 0,

        y: 0,
        width: global.screen_width,
        height: global.screen_height,
      });
      const [, , , scale] = global.stage.get_capture_final_size(rect);
      this.content = global.stage.paint_to_content(
        rect,
        scale,
        Clutter.PaintFlag.NO_CURSORS
      );

      this.opacity = 255;
      this.show();
    }

    run(onComplete = () => {}) {
      this.remove_all_transitions();

      this.ease({
        opacity: 0,
        duration: TRANSITION_DURATION,
        mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        onStopped: this.onStopped,
        onComplete,
      });
    }

    onStopped() {
      if (this?.opacity < 1) this.hide();
    }
  }
);

export const optimizeTransition = new (class OptimizeTransition {
  init(settings) {
    this._settings = settings;

    this.setTransitionDuration(
      this._settings.get_int("darklight-transition-duration")
    );
    this.setClickDelay(this._settings.get_int("darkmode-toggle-clickdelay"));
  }

  enable() {
    if (this.enabled) return;
    this.enabled = true;

    this.darkModeTransition = new DarkModeTransition();

    Main.layoutManager.darkModeTransition = this.darkModeTransition;
    Main.layoutManager.uiGroup.add_child(this.darkModeTransition);

    this.darkModeTransition.add_constraint(
      new Clutter.BindConstraint({
        source: Main.layoutManager.uiGroup,
        coordinate: Clutter.BindCoordinate.ALL,
      })
    );

    const darkModeToggle =
      Main.panel?.statusArea["quickSettings"]?._darkMode
        ?.quickSettingsItems?.[0];

    if (darkModeToggle && typeof darkModeToggle._toggleMode === "function") {
      if (!this._originalToggleMode)
        this._originalToggleMode = darkModeToggle._toggleMode;

      darkModeToggle._toggleMode = this._patchedToggleMode.bind(darkModeToggle);
    }
  }

  disable() {
    if (!this.enabled) return;
    this.enabled = false;

    this._settings = null;

    if (this.darkModeTransition) {
      Main.layoutManager.uiGroup.remove_child(this.darkModeTransition);
      Main.layoutManager.darkModeTransition = null;
      this.darkModeTransition.destroy();
      this.darkModeTransition = null;
    }

    const darkModeToggle =
      Main.panel?.statusArea["quickSettings"]?._darkMode
        ?.quickSettingsItems?.[0];

    if (darkModeToggle && typeof darkModeToggle._toggleMode === "function")
      darkModeToggle._toggleMode = this._originalToggleMode;
  }

  toggle(boolean) {
    if (boolean) return this.enable();
    this.disable();
  }

  setClickDelay(ms) {
    CLICK_DELAY = ms;
  }

  setTransitionDuration(ms) {
    TRANSITION_DURATION = ms;
  }

  _patchedToggleMode() {
    // Main.layoutManager.screenTransition.run();

    // Handle when user click dark mode toggle multiple time
    if (this.secondClick || optimizeTransition.inProgress) return;

    this.secondClick = true;

    this._toggleTimeoutId = GLib.timeout_add(
      GLib.PRIORITY_DEFAULT,
      CLICK_DELAY,
      () => {
        this._toggleTimeoutId = 0;
        this.secondClick = false;
        return GLib.SOURCE_REMOVE;
      }
    );

    optimizeTransition.darkModeTransition?.cloneSceenAndDisplay();
    this._settings.set_string(
      "color-scheme",
      this.checked ? "default" : "prefer-dark"
    );
  }
})();
