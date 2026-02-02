/**
 * MCP Prompts Registration
 *
 * Registers all available prompts with the MCP server.
 * These prompts guide LLMs to use Quire tools effectively for common workflows.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Register all prompts with the MCP server
 */
export function registerPrompts(server: McpServer): void {
  // Create Project Plan prompt
  server.registerPrompt(
    "quire.create-project-plan",
    {
      description:
        "Generate a task plan from a goal description. " +
        "Helps break down a high-level goal into actionable tasks with proper hierarchy.",
      argsSchema: {
        projectId: z
          .string()
          .describe(
            "The project ID (e.g., 'my-project') where tasks will be created"
          ),
        goal: z
          .string()
          .describe(
            "The goal or objective to plan for (e.g., 'Launch new marketing website')"
          ),
      },
    },
    (args) => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `You are a project planning assistant with access to Quire task management tools.

**Goal:** ${args.goal}
**Project ID:** ${args.projectId}

Please help me create a comprehensive task plan to achieve this goal. Follow these steps:

1. **Analyze the goal** and break it down into major phases or milestones
2. **Create tasks** for each phase using the \`quire.createTask\` tool
3. **Add subtasks** where appropriate by using the \`parentOid\` parameter
4. **Set appropriate properties** for each task:
   - Priority: -1 (low), 0 (medium), 1 (high), 2 (urgent)
   - Status: 0 (to-do) by default
   - Due dates in ISO 8601 format if applicable
   - Descriptions in markdown format for complex tasks

**Available Tools:**
- \`quire.createTask\` - Create tasks with name, description, priority, status, due, start, assignees, tags, parentOid
- \`quire.listTasks\` - List existing tasks to avoid duplicates
- \`quire.listTags\` - Get available tags for categorization
- \`quire.listProjectMembers\` - Get team members for assignment
- \`quire.createTag\` - Create new tags if needed for organization

**Guidelines:**
- Create 5-15 top-level tasks depending on goal complexity
- Use clear, actionable task names starting with a verb
- Add descriptions for tasks that need clarification
- Consider dependencies and logical ordering
- Group related work under parent tasks

Start by listing existing tasks in the project to understand the current state, then create the task plan.`,
            },
          },
        ],
      };
    }
  );

  // Daily Standup prompt
  server.registerPrompt(
    "quire.daily-standup",
    {
      description:
        "Generate a daily standup summary. " +
        "Summarizes yesterday's completed work and today's priorities.",
      argsSchema: {
        projectId: z
          .string()
          .describe(
            "The project ID (e.g., 'my-project') to generate standup for"
          ),
        userId: z
          .string()
          .optional()
          .describe(
            "Optional user ID to filter tasks for a specific team member"
          ),
      },
    },
    (args) => {
      const userId = args.userId;
      const projectId = args.projectId;
      const userFilter = userId
        ? `\n**Focus on:** Tasks assigned to user ID "${userId}"`
        : "";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `You are a standup meeting assistant with access to Quire task management tools.

**Project ID:** ${projectId}${userFilter}

Please generate a daily standup summary. Follow these steps:

1. **Gather Information:**
   - Use \`quire.listTasks\` to get all tasks in the project
   - Use \`quire.listProjectMembers\` to understand the team
   ${userId ? `- Focus on tasks assigned to the specified user` : "- Consider all team members"}

2. **Identify Yesterday's Work:**
   - Find tasks with status = 100 (completed) that were recently updated
   - Look for tasks that moved from in-progress to done
   - Check comments for progress updates using \`quire.listTaskComments\`

3. **Identify Today's Priorities:**
   - Find high-priority tasks (priority 1 or 2) that are not complete
   - Look for tasks with due dates today or overdue
   - Identify tasks currently in progress (status > 0 and < 100)
   - Consider blocked tasks that need attention

4. **Format the Standup Report:**

**Yesterday's Accomplishments:**
- [List completed tasks and key progress]

**Today's Priorities:**
- [List tasks to focus on today, ordered by priority]

**Blockers/Concerns:**
- [Any issues or blockers identified]

**Available Tools:**
- \`quire.listTasks\` - List tasks (use projectId parameter)
- \`quire.getTask\` - Get detailed task information
- \`quire.listTaskComments\` - View task comments for context
- \`quire.listProjectMembers\` - Get team member information

Start by fetching the project tasks to analyze the current state.`,
            },
          },
        ],
      };
    }
  );

  // Sprint Planning prompt
  server.registerPrompt(
    "quire.sprint-planning",
    {
      description:
        "Help plan a sprint from the backlog. " +
        "Analyzes incomplete tasks and helps prioritize work for the sprint period.",
      argsSchema: {
        projectId: z
          .string()
          .describe("The project ID (e.g., 'my-project') to plan sprint for"),
        sprintDays: z
          .number()
          .describe(
            "Number of days in the sprint (e.g., 7 for a week, 14 for two weeks)"
          ),
      },
    },
    (args) => {
      const sprintDays = args.sprintDays;
      const projectId = args.projectId;
      const sprintEndDate = new Date();
      sprintEndDate.setDate(sprintEndDate.getDate() + sprintDays);
      const sprintEndISO = sprintEndDate.toISOString().split("T")[0];

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `You are a sprint planning assistant with access to Quire task management tools.

**Project ID:** ${projectId}
**Sprint Duration:** ${String(sprintDays)} days
**Sprint End Date:** ${sprintEndISO}

Please help plan this sprint. Follow these steps:

1. **Analyze the Backlog:**
   - Use \`quire.listTasks\` to get all tasks in the project
   - Filter for incomplete tasks (status < 100)
   - Note task priorities, due dates, and dependencies

2. **Assess Team Capacity:**
   - Use \`quire.listProjectMembers\` to see available team members
   - Consider current workload (tasks already in progress)

3. **Select Sprint Tasks:**
   Based on the ${String(sprintDays)}-day sprint, recommend tasks to include:
   - High-priority tasks (priority 1-2) should be addressed first
   - Tasks with upcoming due dates within the sprint
   - Tasks that are prerequisites for other work
   - Balance workload across team members

4. **Update Selected Tasks:**
   For tasks selected for the sprint, use \`quire.updateTask\` to:
   - Set appropriate due dates within the sprint (before ${sprintEndISO})
   - Adjust priorities if needed
   - Add/update assignees for workload balance

5. **Create Sprint Summary:**

**Sprint Goal:** [Summarize what this sprint aims to achieve]

**Selected Tasks:**
| Task | Priority | Assignee | Due Date |
|------|----------|----------|----------|
| [task details] |

**Capacity Notes:**
- [Observations about team capacity]

**Risks/Dependencies:**
- [Any risks or dependencies to watch]

**Available Tools:**
- \`quire.listTasks\` - Get backlog tasks
- \`quire.getTask\` - Get task details
- \`quire.updateTask\` - Update task properties (priority, due, assignees)
- \`quire.listProjectMembers\` - Get team members
- \`quire.listTags\` - Get tags for categorization

Start by fetching all tasks to analyze the backlog.`,
            },
          },
        ],
      };
    }
  );

  // Task Breakdown prompt
  server.registerPrompt(
    "quire.task-breakdown",
    {
      description:
        "Break down a task into subtasks. " +
        "Analyzes a complex task and decomposes it into smaller, actionable subtasks.",
      argsSchema: {
        taskOid: z
          .string()
          .describe("The OID of the task to break down into subtasks"),
      },
    },
    (args) => {
      const taskOid = args.taskOid;
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `You are a task decomposition assistant with access to Quire task management tools.

**Task OID:** ${taskOid}

Please help break down this task into smaller, actionable subtasks. Follow these steps:

1. **Analyze the Parent Task:**
   - Use \`quire.getTask\` with oid "${taskOid}" to get full task details
   - Understand the scope, description, and requirements
   - Note any existing subtasks using \`quire.listTasks\` with parentTaskOid

2. **Identify Subtasks:**
   Consider breaking down the task by:
   - Sequential steps needed to complete the work
   - Different components or modules
   - Preparation, execution, and verification phases
   - Different skill areas or team member responsibilities

3. **Create Subtasks:**
   Use \`quire.createTask\` with parentOid "${taskOid}" for each subtask:
   - Keep subtask names clear and actionable (start with a verb)
   - Add descriptions for complex subtasks
   - Set appropriate priorities relative to the parent
   - Consider time estimates and dependencies

4. **Recommended Subtask Structure:**
   - 3-7 subtasks per parent task (avoid too granular)
   - Each subtask should be completable in 1-4 hours
   - Subtasks should be independent when possible
   - Include a verification/review subtask if appropriate

**Available Tools:**
- \`quire.getTask\` - Get parent task details (use oid parameter)
- \`quire.listTasks\` - List existing subtasks (use parentTaskOid parameter)
- \`quire.createTask\` - Create subtasks (use parentOid to nest under parent)
- \`quire.updateTask\` - Update parent task if needed
- \`quire.listTaskComments\` - Check for additional context in comments

**Output Format:**

**Parent Task Analysis:**
- Name: [task name]
- Description: [task description]
- Current Status: [status]

**Proposed Subtasks:**
1. [Subtask name] - [Brief description]
2. [Subtask name] - [Brief description]
...

**Rationale:**
[Explain why this breakdown makes sense]

Start by fetching the task details to understand what needs to be broken down.`,
            },
          },
        ],
      };
    }
  );

  // Weekly Summary prompt
  server.registerPrompt(
    "quire.weekly-summary",
    {
      description:
        "Generate a weekly progress report. " +
        "Summarizes the week's accomplishments, metrics, and upcoming work.",
      argsSchema: {
        projectId: z
          .string()
          .describe(
            "The project ID (e.g., 'my-project') to generate summary for"
          ),
      },
    },
    (args) => {
      const projectId = args.projectId;
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoISO = weekAgo.toISOString().split("T")[0];

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `You are a project reporting assistant with access to Quire task management tools.

**Project ID:** ${projectId}
**Report Period:** Last 7 days (since ${weekAgoISO})

Please generate a comprehensive weekly progress report. Follow these steps:

1. **Gather Project Data:**
   - Use \`quire.getProject\` to get project overview and task counts
   - Use \`quire.listTasks\` to get all tasks
   - Use \`quire.listProjectMembers\` to get team information

2. **Analyze Completed Work:**
   - Identify tasks completed this week (status = 100)
   - Note significant achievements and milestones
   - Calculate completion metrics

3. **Analyze Current State:**
   - Count tasks by status (to-do, in-progress, complete)
   - Identify overdue tasks (due date passed, not complete)
   - Note high-priority items still pending

4. **Assess Team Activity:**
   - Look at task assignments and completions by team member
   - Identify any capacity issues or imbalances

5. **Look Ahead:**
   - Tasks due in the coming week
   - Upcoming milestones or deadlines
   - Potential blockers or risks

**Generate Report:**

# Weekly Progress Report
**Project:** [Project Name]
**Period:** ${weekAgoISO} to ${today.toISOString().split("T")[0]}

## Executive Summary
[2-3 sentence overview of the week]

## Accomplishments
- [Key completed tasks and achievements]

## Metrics
| Metric | Value |
|--------|-------|
| Tasks Completed | X |
| Tasks In Progress | X |
| Tasks Remaining | X |
| Completion Rate | X% |

## Team Highlights
[Notable contributions by team members]

## Upcoming Priorities
- [Tasks and milestones for next week]

## Risks & Blockers
- [Any issues requiring attention]

## Recommendations
- [Suggestions for improvement]

**Available Tools:**
- \`quire.getProject\` - Get project details and counts
- \`quire.listTasks\` - Get all tasks for analysis
- \`quire.getTask\` - Get detailed task information
- \`quire.listTaskComments\` - Check recent activity
- \`quire.listProjectMembers\` - Get team roster

Start by fetching the project details and task list to analyze the week's progress.`,
            },
          },
        ],
      };
    }
  );
}
