import type { WtfIssuePriority, WtfIssueStatus, WtfWorkspaceRole } from "../lib/wtf-api";
import type { FlowFocusReasonKey, FlowRecommendationKey, FlowRiskTone } from "./flow-insights";

/**
 * Поддерживаемая локаль интерфейса.
 */
export type WorkspaceLocale = "ru" | "en";

/**
 * Поддерживаемая тема интерфейса.
 */
export type WorkspaceTheme = "light" | "dark";

/**
 * Пример email для формы регистрации.
 */
export const demoEmail = "user@example.com";

/**
 * Словари рабочей поверхности.
 */
export const copyByLocale = {
  ru: {
    appName: "WTF",
    coreWorkspace: "Основной workspace",
    controls: {
      themeToggle: "Тема",
      switchToDark: "Темная тема",
      switchToLight: "Светлая тема",
      switchLanguage: "Switch to English",
      languageLabel: "RU",
    },
    connection: {
      offline: "нет связи",
      syncing: "синхронизация",
      signIn: "вход",
      synced: "синхронизировано",
    },
    header: {
      signOut: "Выйти",
      issue: "Задача",
    },
    nav: {
      issues: "Задачи",
      sprints: "Спринты",
    },
    workspace: {
      personal: "Личный workspace",
      corporate: "Корпоративный workspace",
      switcherTitle: "Мои workspace",
      internalNumber: "Внутренний номер",
      copyInternalNumber: "Скопировать внутренний номер",
      copied: (internalNumber: string): string => `${internalNumber} скопирован`,
      copyFailed: "Не удалось скопировать внутренний номер",
    },
    signIn: {
      subtitle: "Войдите или зарегистрируйтесь",
      loginTab: "Вход",
      registerTab: "Регистрация",
      emailLabel: "Email",
      passwordLabel: "Пароль",
      demoHint: "Пример email",
      useDemo: "Подставить user@example.com",
      loginSubmit: "Войти",
      registerSubmit: "Зарегистрироваться",
      resendVerification: "Отправить письмо еще раз",
      emailRequired: "Нужен рабочий email",
      passwordRequired: "Пароль должен быть не короче 8 символов",
      verificationSent: (email: string): string =>
        `Письмо отправлено на ${email}. Нажмите кнопку подтверждения в письме, затем войдите с паролем.`,
      verificationResent: (email: string): string =>
        `Если ${email} еще ожидает подтверждения, новое письмо отправлено.`,
    },
    members: {
      title: "Участники",
      emailLabel: "Email",
      roleLabel: "Роль",
      add: "Добавить",
      emailRequired: "Нужен email участника",
    },
    workspaceAccess: {
      title: "Корпоративный доступ",
      internalNumberLabel: "Внутренний номер",
      internalNumberPlaceholder: "CORP-001",
      request: "Открыть / запросить",
      createTitle: "Создать корпоративный",
      workspaceNameLabel: "Название",
      workspaceNamePlaceholder: "Команда продукта",
      create: "Создать",
      pendingTitle: "Заявки",
      approve: "Подтвердить",
      internalNumberRequired: "Введите внутренний номер workspace",
      workspaceNameRequired: "Введите название workspace",
      requestSent: (internalNumber: string): string =>
        `Заявка для ${internalNumber} отправлена владельцу.`,
      created: (internalNumber: string): string =>
        `Корпоративный workspace ${internalNumber} создан.`,
      approved: "Заявка подтверждена",
    },
    issues: {
      title: "Задачи",
      loading: "Загружаю задачи",
      count: (count: number): string => `${count} ${pluralRu(count, "задача", "задачи", "задач")}`,
      filteredCount: (visible: number, total: number): string =>
        `${visible} из ${total} ${pluralRu(total, "задачи", "задач", "задач")}`,
      empty: "Задач пока нет",
      noMatches: "Ничего не найдено",
      searchLabel: "Поиск задач",
      searchPlaceholder: "Поиск по ключу, названию, описанию",
      clearFilters: "Сбросить",
      filters: {
        all: "Все",
        open: "Открытые",
        closed: "Закрытые",
        urgent: "Срочные",
      },
      list: "Список",
      board: "Доска",
      newIssue: "Новая задача",
      titleLabel: "Название",
      descriptionLabel: "Описание",
      priorityLabel: "Приоритет",
      cancel: "Отмена",
      create: "Создать",
      retry: "Повторить",
      dismissError: "Закрыть ошибку",
      movedBy: (actor: string): string => `Перенес: ${actor}`,
      closedBy: (actor: string): string => `Закрыл: ${actor}`,
      titleTooShort: "Название задачи должно быть не короче 3 символов",
      contextNotReady: "Контекст проекта еще не готов",
      readOnly: "Ваша роль в workspace только для чтения",
    },
    inspector: {
      none: "Задача не выбрана",
      movement: "Движение",
      status: "Статус",
      description: "Описание",
      noDescription: "Описание не заполнено",
      comments: "Комментарии",
      noComments: "Комментариев нет",
      writeComment: "Написать комментарий",
      comment: "Комментировать",
      activity: "Активность",
      created: "Создана",
      updated: "Обновлена",
      moved: "Перенос",
      closedAt: "Закрыта",
      never: "никогда",
      unknown: "неизвестно",
      you: "вы",
      open: "открыта",
      closed: "закрыта",
      commentRequired: "Нужен текст комментария",
      issueContextNotReady: "Контекст задачи еще не готов",
      activities: {
        created: (actor: string): string => `${actor} создал задачу`,
        commented: (actor: string): string => `${actor} оставил комментарий`,
        assigned: (actor: string): string => `${actor} назначил исполнителя`,
        subtaskAdded: (actor: string): string => `${actor} добавил подзадачу`,
        relationAdded: (actor: string): string => `${actor} связал задачу`,
        moved: (actor: string, from: string, to: string): string =>
          `${actor} перенес ${from} -> ${to}`,
        fallback: (actor: string, verb: string): string => `${actor}: ${verb}`,
      },
    },
    flow: {
      title: "Flow Radar",
      focus: "Фокус",
      nextFocus: "Следующий фокус",
      noOpenIssues: "Нет открытых задач",
      risk: {
        green: "норма",
        amber: "внимание",
        red: "риск",
      } satisfies Record<FlowRiskTone, string>,
      metrics: {
        wip: "WIP",
        closed7d: "Закрыто 7д",
        stale: "Застой",
        comments: "Комментарии",
        pressure: (value: number): string => `${value}% нагрузки`,
        open: (value: number): string => `${value} открыто`,
        staleDetail: "3+ дня без движения",
        perIssue: (value: number): string => `${value} на задачу`,
      },
      recommendations: {
        urgent: "Сначала заберите срочные задачи в активную работу, потом пополняйте backlog.",
        review_constraint: "Review стал ограничением. Очистите review до старта новой разработки.",
        stale_work: "Обновите застоявшиеся задачи: двигать дальше, отложить или закрыть.",
        wip_limit: "WIP выше комфортного лимита. Завершите активную работу до новых задач.",
        no_recent_closures: "Нет недавних закрытий. Доведите одну активную задачу до финала.",
        balanced: "Поток сбалансирован. Держите очередь короткой и берегите review lane.",
      } satisfies Record<FlowRecommendationKey, string>,
      focusReasons: {
        urgent_open: "срочный приоритет еще открыт",
        stale: "нет движения 3+ дня",
        review: "review ближе всего к релизу",
        highest_risk: "самый высокий текущий риск потока",
      } satisfies Record<FlowFocusReasonKey, string>,
    },
    statusLabels: {
      backlog: "Backlog",
      todo: "Todo",
      in_progress: "В работе",
      in_review: "Review",
      done: "Done",
      canceled: "Отменено",
    } satisfies Record<WtfIssueStatus, string>,
    priorityLabels: {
      low: "низкий",
      medium: "средний",
      high: "высокий",
      urgent: "срочно",
    } satisfies Record<WtfIssuePriority, string>,
    roleLabels: {
      owner: "owner",
      admin: "admin",
      member: "member",
      viewer: "viewer",
    } satisfies Record<WtfWorkspaceRole, string>,
    errors: {
      unexpected: "Что-то пошло не так. Повторите действие.",
      byCode: {
        network_timeout: "API не ответил за 15 секунд. Проверьте соединение и повторите.",
        network_error: "API недоступен. Проверьте, что сервер запущен.",
        invalid_credentials: "Email или пароль неверны.",
        email_not_verified:
          "Email еще не подтвержден. Откройте письмо и подтвердите учетную запись.",
        email_already_registered: "Этот email уже зарегистрирован. Войдите с паролем.",
        validation_error: "Проверьте заполненные поля.",
        workspace_internal_number_not_found: "Workspace с таким внутренним номером не найден.",
        workspace_owner_required: "Это действие доступно только владельцу workspace.",
        member_email_not_verified: "Участник должен зарегистрироваться и подтвердить email.",
        join_request_already_decided: "Эта заявка уже обработана.",
      } satisfies Record<string, string>,
    },
  },
  en: {
    appName: "WTF",
    coreWorkspace: "Core Workspace",
    controls: {
      themeToggle: "Theme",
      switchToDark: "Dark theme",
      switchToLight: "Light theme",
      switchLanguage: "Переключить на русский",
      languageLabel: "EN",
    },
    connection: {
      offline: "offline",
      syncing: "syncing",
      signIn: "sign in",
      synced: "synced",
    },
    header: {
      signOut: "Sign out",
      issue: "Issue",
    },
    nav: {
      issues: "Issues",
      sprints: "Sprints",
    },
    workspace: {
      personal: "Personal workspace",
      corporate: "Corporate workspace",
      switcherTitle: "My workspaces",
      internalNumber: "Internal number",
      copyInternalNumber: "Copy internal number",
      copied: (internalNumber: string): string => `${internalNumber} copied`,
      copyFailed: "Could not copy internal number",
    },
    signIn: {
      subtitle: "Sign in or register",
      loginTab: "Sign in",
      registerTab: "Register",
      emailLabel: "Email",
      passwordLabel: "Password",
      demoHint: "Email example",
      useDemo: "Use user@example.com",
      loginSubmit: "Sign in",
      registerSubmit: "Register",
      resendVerification: "Send email again",
      emailRequired: "Work email is required",
      passwordRequired: "Password must contain at least 8 characters",
      verificationSent: (email: string): string =>
        `Email sent to ${email}. Click the confirmation button in the email, then sign in with your password.`,
      verificationResent: (email: string): string =>
        `If ${email} is still waiting for verification, a new email has been sent.`,
    },
    members: {
      title: "Members",
      emailLabel: "Email",
      roleLabel: "Role",
      add: "Add",
      emailRequired: "Member email is required",
    },
    workspaceAccess: {
      title: "Corporate access",
      internalNumberLabel: "Internal number",
      internalNumberPlaceholder: "CORP-001",
      request: "Open / request",
      createTitle: "Create corporate",
      workspaceNameLabel: "Name",
      workspaceNamePlaceholder: "Product team",
      create: "Create",
      pendingTitle: "Requests",
      approve: "Approve",
      internalNumberRequired: "Enter workspace internal number",
      workspaceNameRequired: "Enter workspace name",
      requestSent: (internalNumber: string): string =>
        `Request for ${internalNumber} was sent to the owner.`,
      created: (internalNumber: string): string =>
        `Corporate workspace ${internalNumber} was created.`,
      approved: "Request approved",
    },
    issues: {
      title: "Issues",
      loading: "Loading work items",
      count: (count: number): string => `${count} work items`,
      filteredCount: (visible: number, total: number): string =>
        `${visible} of ${total} work items`,
      empty: "No issues yet",
      noMatches: "No matching issues",
      searchLabel: "Search issues",
      searchPlaceholder: "Search key, title, description",
      clearFilters: "Clear",
      filters: {
        all: "All",
        open: "Open",
        closed: "Closed",
        urgent: "Urgent",
      },
      list: "List",
      board: "Board",
      newIssue: "New issue",
      titleLabel: "Title",
      descriptionLabel: "Description",
      priorityLabel: "Priority",
      cancel: "Cancel",
      create: "Create",
      retry: "Retry",
      dismissError: "Dismiss error",
      movedBy: (actor: string): string => `Moved by ${actor}`,
      closedBy: (actor: string): string => `Closed by ${actor}`,
      titleTooShort: "Issue title must contain at least 3 characters",
      contextNotReady: "Project context is not ready",
      readOnly: "Your workspace role is read-only",
    },
    inspector: {
      none: "No issue selected",
      movement: "Movement",
      status: "Status",
      description: "Description",
      noDescription: "No description",
      comments: "Comments",
      noComments: "No comments",
      writeComment: "Write a comment",
      comment: "Comment",
      activity: "Activity",
      created: "Created",
      updated: "Updated",
      moved: "Moved",
      closedAt: "Closed",
      never: "never",
      unknown: "unknown",
      you: "you",
      open: "open",
      closed: "closed",
      commentRequired: "Comment body is required",
      issueContextNotReady: "Issue context is not ready",
      activities: {
        created: (actor: string): string => `${actor} created issue`,
        commented: (actor: string): string => `${actor} commented`,
        assigned: (actor: string): string => `${actor} assigned issue`,
        subtaskAdded: (actor: string): string => `${actor} added subtask`,
        relationAdded: (actor: string): string => `${actor} linked issue`,
        moved: (actor: string, from: string, to: string): string =>
          `${actor} moved ${from} -> ${to}`,
        fallback: (actor: string, verb: string): string => `${actor} ${verb}`,
      },
    },
    flow: {
      title: "Flow Radar",
      focus: "Focus",
      nextFocus: "Next focus",
      noOpenIssues: "No open issues",
      risk: {
        green: "healthy",
        amber: "watch",
        red: "at risk",
      } satisfies Record<FlowRiskTone, string>,
      metrics: {
        wip: "WIP",
        closed7d: "Closed 7d",
        stale: "Stale",
        comments: "Comments",
        pressure: (value: number): string => `${value}% pressure`,
        open: (value: number): string => `${value} open`,
        staleDetail: "3+ days without movement",
        perIssue: (value: number): string => `${value} per issue`,
      },
      recommendations: {
        urgent: "Pull urgent work into the active lane before adding new backlog.",
        review_constraint:
          "Review is the constraint. Clear review before starting more implementation.",
        stale_work: "Refresh stale open work and decide whether it moves, waits, or closes.",
        wip_limit: "WIP is above the comfort limit. Finish active work before creating more.",
        no_recent_closures:
          "No recent closures. Pick one active issue and drive it to a terminal status.",
        balanced: "Flow is balanced. Keep the queue small and protect the current review lane.",
      } satisfies Record<FlowRecommendationKey, string>,
      focusReasons: {
        urgent_open: "urgent priority is still open",
        stale: "no movement for 3+ days",
        review: "review work is closest to release",
        highest_risk: "highest current flow risk",
      } satisfies Record<FlowFocusReasonKey, string>,
    },
    statusLabels: {
      backlog: "Backlog",
      todo: "Todo",
      in_progress: "In progress",
      in_review: "Review",
      done: "Done",
      canceled: "Canceled",
    } satisfies Record<WtfIssueStatus, string>,
    priorityLabels: {
      low: "low",
      medium: "medium",
      high: "high",
      urgent: "urgent",
    } satisfies Record<WtfIssuePriority, string>,
    roleLabels: {
      owner: "owner",
      admin: "admin",
      member: "member",
      viewer: "viewer",
    } satisfies Record<WtfWorkspaceRole, string>,
    errors: {
      unexpected: "Something went wrong. Try again.",
      byCode: {
        network_timeout:
          "The API did not respond within 15 seconds. Check the connection and retry.",
        network_error: "The API is unavailable. Check that the server is running.",
        invalid_credentials: "Email or password is incorrect.",
        email_not_verified: "Email is not verified yet. Open the email and confirm your account.",
        email_already_registered: "This email is already registered. Sign in with your password.",
        validation_error: "Check the fields and try again.",
        workspace_internal_number_not_found: "No workspace was found for this internal number.",
        workspace_owner_required: "Only the workspace owner can do this.",
        member_email_not_verified: "The member must register and verify email first.",
        join_request_already_decided: "This request has already been processed.",
      } satisfies Record<string, string>,
    },
  },
} as const;

/**
 * Словарь конкретной локали.
 */
export type WorkspaceCopy = (typeof copyByLocale)[WorkspaceLocale];

/**
 * Возвращает локализованное название статуса.
 */
export function statusLabel(status: string, copy: WorkspaceCopy): string {
  if (isIssueStatus(status)) {
    return copy.statusLabels[status];
  }

  return status;
}

function isIssueStatus(status: string): status is WtfIssueStatus {
  return (
    status === "backlog" ||
    status === "todo" ||
    status === "in_progress" ||
    status === "in_review" ||
    status === "done" ||
    status === "canceled"
  );
}

function pluralRu(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return one;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return few;
  }

  return many;
}
