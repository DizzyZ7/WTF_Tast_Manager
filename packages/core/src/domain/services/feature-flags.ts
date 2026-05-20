/**
 * Ключ feature flag в WTF.
 */
export type FeatureFlagKey =
  | "realtime.rich_text_crdt"
  | "issues.subtasks"
  | "issues.relations"
  | "projects.sprints"
  | "auth.oauth";

/**
 * Контекст проверки feature flag.
 */
export interface FeatureFlagContext {
  /** Workspace, для которого проверяется флаг. */
  readonly workspaceId?: string;
  /** Пользователь, для которого проверяется флаг. */
  readonly userId?: string;
}

/**
 * Провайдер feature flags.
 */
export interface FeatureFlagProvider {
  /** Возвращает `true`, если флаг включен для контекста. */
  isEnabled(key: FeatureFlagKey, context?: FeatureFlagContext): boolean;
}

/**
 * Детерминированный provider feature flags для локального запуска и тестов.
 */
export class StaticFeatureFlags implements FeatureFlagProvider {
  private readonly flags: ReadonlyMap<FeatureFlagKey, boolean>;

  /**
   * Создает provider на основе статического словаря.
   */
  public constructor(flags: Partial<Record<FeatureFlagKey, boolean>>) {
    this.flags = new Map(Object.entries(flags) as Array<[FeatureFlagKey, boolean]>);
  }

  /**
   * Проверяет значение флага без побочных эффектов.
   */
  public isEnabled(key: FeatureFlagKey): boolean {
    return this.flags.get(key) ?? false;
  }
}
