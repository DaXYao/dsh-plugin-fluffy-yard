/**
 * 全部调参常量（implementation-plan §6）。
 * 改这里不动逻辑；运行期不重新读取。
 */

/** 在场宠物数量上限（需求 §3.1）。 */
export const MAX_PETS = 5

/** 到访间隔默认值（分钟；需求 §3.1：默认 30，可配 30 秒 ~ 24 小时——下限 0.5 分钟为 UX 需求）。 */
export const SPAWN_INTERVAL_DEFAULT_MIN = 30
export const SPAWN_INTERVAL_MIN_MIN = 0.5
export const SPAWN_INTERVAL_MAX_MIN = 24 * 60

/** 离线补访上限（需求 §3.1：最多补 1 只）。 */
export const OFFLINE_SPAWN_CAP = 1

/** 配饰出现概率（需求 §3.2：低概率；命中后等概率选围巾/铃铛/蝴蝶结）。 */
export const ACCESSORY_RATE = 0.15

/** 特征组合冲突重摇上限；耗尽即进入下一轮回（§L5）。 */
export const COMBO_RETRY_LIMIT = 2000

/** 宠物 id 序号补零宽度：p_000042。 */
export const ID_PAD = 6

/** 用户重命名的最大长度。 */
export const PET_NAME_MAX = 12

/** 场景最小宽度：低于即“极小”档（implementation-plan §3.5/§6）。 */
export const MIN_STAGE_W = 120

/** 舒适格位宽（px）：可见格位数 = floor(宽 / CELL_W)（tiers.ts；P2 手册 CP1 清单遗漏，按 §3.5 语义补）。 */
export const CELL_W = 140

/** 场景高度低于此值触发全员“躺平”彩蛋（需求 §3.7）。 */
export const FLATTEN_H = 160

/** 行走速度（px/秒）。 */
export const WALK_SPEED = 90

/** 引擎到访检查周期（活跃毫秒数；implementation-plan §3.9）。 */
export const SPAWN_CHECK_MS = 30_000

/** 存档保存防抖（毫秒）。 */
export const SAVE_DEBOUNCE_MS = 2000

/** 聚光灯轮换周期（ms，需求 §3.7：约每 15 秒一次）。 */
export const ROTATE_MS = 15_000

/** 锁定宠物的聚光灯时长（ms，需求 §3.7：加倍 30s）。 */
export const ROTATE_LOCKED_MS = 30_000

/** 合影：全部到位后的稳定等待（ms，implementation-plan §6）。 */
export const PHOTO_SETTLE_MS = 800

/** 合影：召回移动的超时上限（ms；宽舞台最远槽位约 3.1s，P4 遗留 #1 调大）。 */
export const PHOTO_TIMEOUT_MS = 5000

/** 家具（墙/窗/沙发/桌）显示的最小舞台宽度（P6 F2）。 */
export const FURNITURE_MIN_W = 420

/** 食碗/水碗显示的最小舞台宽度。 */
export const BOWLS_MIN_W = 240

/** 食盆份数上限与每次添食量（F6）。 */
export const FOOD_MAX_SERVINGS = 5
export const FOOD_REFILL_ADD = 3

/** 吃喝/溜达节奏（ms，[min, max] 随机；F4/F5）。 */
export const MEAL_GAP_MS: readonly [number, number] = [40_000, 90_000]
export const DRINK_GAP_MS: readonly [number, number] = [50_000, 110_000]
export const STROLL_GAP_MS: readonly [number, number] = [25_000, 60_000]

/** 互动节奏与时长（F7）。 */
export const IA_GAP_MS: readonly [number, number] = [18_000, 35_000]
export const CHASE_MS = 4_000
export const CUDDLE_MS = 1_600
export const BALL_BATS = 3

