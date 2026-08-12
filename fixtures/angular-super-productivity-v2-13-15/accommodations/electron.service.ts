/**
 * ACCOMMODATION PAYLOAD — copied verbatim into the migrated tree as
 * `src/app/core/electron/electron.service.ts` by the u18h round.
 *
 * ngx-electron@2.2.0 is a View Engine library: it ships `ngx-electron.metadata.json`
 * and no Ivy definition anywhere, and Angular 16 removed ngcc, the tool that used
 * to translate such a package. No rewrite of application source turns
 * `NgxElectronModule` into an NgModule, so no capability can reach it — the u18g
 * record established that. What the application actually uses from the package is
 * one injectable, `ElectronService`, at 21 modules, and every use of it is behind
 * an `IS_ELECTRON` guard the application already owns.
 *
 * This file is that injectable, re-implemented from the installed package's own
 * UMD bundle so the web lane keeps the same behaviour it had: `electron` is read
 * off `window.require('electron')` when the host provides it and is `null` in a
 * browser, `isElectronApp` is the same user-agent test, and every accessor
 * returns the same thing the package's accessor returned. It is deliberately not
 * an improvement on the package: it is the package's own 40 lines, minus the
 * NgModule the compiler cannot consume.
 *
 * Two differences from the package are deliberate and are recorded in the
 * evidence rather than hidden here:
 *
 * 1. The service is `providedIn: 'root'` instead of being provided by
 *    `NgxElectronModule`. The module is gone, so something has to provide it, and
 *    root is where every one of its consumers already injects it from.
 * 2. The members are typed structurally rather than against `electron`'s own
 *    typings. The package declared them as `Electron.IpcRenderer` and friends,
 *    which requires the `electron` package's types to be installed; this lane is
 *    the web lane and does not install Electron at all.
 * 3. The platform tests read `this.process`, which is the package's own accessor
 *    for `remote.process`, where the package read the bare Node `process` global.
 *    Under the era's webpack the global was shimmed; Angular 16's builder does not
 *    shim it, and a bare `process` in application source is a reference the web
 *    bundle cannot resolve. Both spellings return the same platform string inside
 *    Electron and both are unreachable outside it, because `isElectronApp` guards
 *    them and is false in a browser.
 */

import {Injectable} from '@angular/core';

type ElectronApi = {
  [member: string]: any;
};

@Injectable({providedIn: 'root'})
export class ElectronService {
  private _electron: ElectronApi | null = null;

  private get electron(): ElectronApi | null {
    if (!this._electron) {
      const host = (typeof window !== 'undefined') ? (window as any) : null;
      if (host && host.require) {
        this._electron = host.require('electron');
        return this._electron;
      }
      return null;
    }
    return this._electron;
  }

  /** determines if SPA is running in Electron */
  get isElectronApp(): boolean {
    return !!(typeof window !== 'undefined' && window.navigator.userAgent.match(/Electron/));
  }

  get isMacOS(): boolean {
    return this.isElectronApp && this.process && this.process.platform === 'darwin';
  }

  get isWindows(): boolean {
    return this.isElectronApp && this.process && this.process.platform === 'win32';
  }

  get isLinux(): boolean {
    return this.isElectronApp && this.process && this.process.platform === 'linux';
  }

  get isX86(): boolean {
    return this.isElectronApp && this.process && this.process.arch === 'ia32';
  }

  get isX64(): boolean {
    return this.isElectronApp && this.process && this.process.arch === 'x64';
  }

  get isArm(): boolean {
    return this.isElectronApp && this.process && this.process.arch === 'arm';
  }

  get desktopCapturer(): any {
    return this.electron ? this.electron.desktopCapturer : null;
  }

  get ipcRenderer(): any {
    return this.electron ? this.electron.ipcRenderer : null;
  }

  get remote(): any {
    return this.electron ? this.electron.remote : null;
  }

  get webFrame(): any {
    return this.electron ? this.electron.webFrame : null;
  }

  get clipboard(): any {
    return this.electron ? this.electron.clipboard : null;
  }

  get crashReporter(): any {
    return this.electron ? this.electron.crashReporter : null;
  }

  get process(): any {
    return this.electron ? this.electron.remote && this.electron.remote.process : null;
  }

  get nativeImage(): any {
    return this.electron ? this.electron.nativeImage : null;
  }

  get screen(): any {
    return this.electron ? this.electron.screen : null;
  }

  get shell(): any {
    return this.electron ? this.electron.shell : null;
  }
}
