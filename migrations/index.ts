import * as migration_20251129_022910 from './20251129_022910';
import * as migration_20260124_052527 from './20260124_052527';
import * as migration_20261009_085505_weekly_status_default_published from './20261009_085505_weekly_status_default_published';

export const migrations = [
  {
    up: migration_20251129_022910.up,
    down: migration_20251129_022910.down,
    name: '20251129_022910',
  },
  {
    up: migration_20260124_052527.up,
    down: migration_20260124_052527.down,
    name: '20260124_052527',
  },
  {
    up: migration_20261009_085505_weekly_status_default_published.up,
    down: migration_20261009_085505_weekly_status_default_published.down,
    name: '20261009_085505_weekly_status_default_published'
  },
];
