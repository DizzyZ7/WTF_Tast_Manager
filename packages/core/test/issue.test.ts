import { describe, expect, it } from "vitest";
import { DomainError, Issue, issueId, projectId, userId, workspaceId } from "../src/index.js";

const now = new Date("2026-05-19T10:00:00.000Z");
const reporterId = userId("00000000-0000-4000-8000-000000000001");
const assigneeId = userId("00000000-0000-4000-8000-000000000002");
const workspace = workspaceId("00000000-0000-4000-8000-000000000010");
const project = projectId("00000000-0000-4000-8000-000000000020");
const relatedIssueId = issueId("00000000-0000-4000-8000-000000000030");

function createIssue(): Issue {
  return Issue.create({
    workspaceId: workspace,
    projectId: project,
    key: "PF-1",
    title: "Implement core domain",
    description: "DDD first",
    reporterId,
    now,
  });
}

describe("Issue", () => {
  it("создает issue с activity log и доменным событием", () => {
    const issue = createIssue();

    expect(issue.toSnapshot()).toMatchObject({
      workspaceId: workspace,
      projectId: project,
      key: "PF-1",
      status: "backlog",
      priority: "medium",
      reporterId,
      assigneeId: null,
    });
    expect(issue.toSnapshot().activities).toHaveLength(1);
    expect(issue.pullDomainEvents()).toHaveLength(1);
  });

  it("проводит допустимый жизненный цикл до done", () => {
    const issue = createIssue();
    const subtask = issue.addSubtask("Add tests", reporterId, now);
    issue.setSubtaskDone(subtask.id, true, now);

    issue.transitionTo("todo", reporterId, now);
    issue.transitionTo("in_progress", reporterId, now);
    issue.transitionTo("in_review", reporterId, now);
    issue.transitionTo("done", reporterId, now);

    expect(issue.toSnapshot().status).toBe("done");
  });

  it("разрешает прямой перенос между колонками board", () => {
    const issue = createIssue();

    issue.transitionTo("done", reporterId, now);
    issue.transitionTo("canceled", reporterId, now);
    issue.transitionTo("backlog", reporterId, now);

    expect(issue.toSnapshot().status).toBe("backlog");
  });

  it("запрещает завершать issue с открытыми подзадачами", () => {
    const issue = createIssue();
    issue.addSubtask("Add tests", reporterId, now);
    issue.transitionTo("todo", reporterId, now);
    issue.transitionTo("in_progress", reporterId, now);
    issue.transitionTo("in_review", reporterId, now);

    expect(() => issue.transitionTo("done", reporterId, now)).toThrow(/незавершенными/);
  });

  it("добавляет комментарий и назначает исполнителя", () => {
    const issue = createIssue();
    issue.assignTo(assigneeId, reporterId, now);
    const comment = issue.addComment(assigneeId, "Looks good", now);

    expect(issue.toSnapshot().assigneeId).toBe(assigneeId);
    expect(issue.toSnapshot().comments).toEqual([comment]);
  });

  it("запрещает дублировать связь", () => {
    const issue = createIssue();
    issue.relateTo("blocks", relatedIssueId, reporterId, now);

    expect(() => issue.relateTo("blocks", relatedIssueId, reporterId, now)).toThrow(DomainError);
  });

  it("запрещает ссылку issue на саму себя", () => {
    const issue = createIssue();
    const snapshot = issue.toSnapshot();

    expect(() => issue.relateTo("relates_to", snapshot.id, reporterId, now)).toThrow(
      /сама на себя/,
    );
  });

  it("не публикует событие при переходе в тот же статус", () => {
    const issue = createIssue();
    issue.pullDomainEvents();

    issue.transitionTo("backlog", reporterId, now);

    expect(issue.pullDomainEvents()).toHaveLength(0);
  });

  it("запрещает комментировать отмененную issue", () => {
    const issue = createIssue();
    issue.transitionTo("canceled", reporterId, now);

    expect(() => issue.addComment(reporterId, "No longer needed", now)).toThrow(/отмененную/);
  });

  it("запрещает менять неизвестную подзадачу", () => {
    const issue = createIssue();

    expect(() => issue.setSubtaskDone(relatedIssueId, true, now)).toThrow(/подзадача не найдена/);
  });
});
