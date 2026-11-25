// The transport itself has no window or lease capabilities.
import {createAppearanceServiceHttpHost} from './appearance-service-host.js';
export function createSidebarHttpHost(options = {}) {
  return createAppearanceServiceHttpHost(options);
}
