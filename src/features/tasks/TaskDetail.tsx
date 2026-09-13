import { useEffect, useMemo, useState } from 'react'
import { CheckIcon, CloseIcon, PlusIcon, TrashIcon } from '@/components/icons'
import {
  createTask,
  deleteTask,
  ensureTags,
  setTaskStatus,
  setTaskTags,
  updateTask,
} from '@/lib/mutations'
import {
  childrenOf,
  useAllTasks,
  useClients,
  useLists,
  useTags,
  useTaskTags,
} from '@/lib/queries'
import { RecurrencePicker } from '@/features/recurrence/RecurrencePicker'
import type { Task, TaskStatus } from '@/lib/types'

const PRIORITIES: { value: number; label: string; tone: string }[] = [
  { value: 1, label: 'P1', tone: 'border-p1 text-p1' },
  { value: 2, label: 'P2', tone: 'border-p2 text-p2' },
  { value: 3, label: 'P3', tone: 'border-p3 text-p3' },
  { value: 0, label: 'None', tone: 'border-line text-muted' },
]

const STATUSES: TaskStatus[] = ['todo', 'doing', 'done', 'cancelled']

export function TaskDetail({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const tasks = useAllTasks()
  const lists = useLists()
  const clients = useClients()
  const allTags = useTags()
  const taskTags = useTaskTags()
  const task = tasks.find((t) => t.id === taskId)

  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [tagText, setTagText] = useState('')
  const [subtaskText, setSubtaskText] = useState('')

  const currentTags = useMemo(() => {
    const ids = new Set(
      taskTags.filter((l) => l.task_id === taskId).map((l) => l.tag_id),
    )
    return allTags.filter((t) => ids.has(t.id))
  }, [taskTags, allTags, taskId])

  useEffect(() => {
    if (!task) return
    setTitle(task.title)
    setNotes(task.notes ?? '')
  }, [task?.id])

  useEffect(() => {
    setTagText(currentTags.map((t) => t.name).join(', '))
  }, [taskId, currentTags.map((t) => t.name).join(',')])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!task) return null

  const children = childrenOf(tasks, task.id)
  const isSubtask = !!task.parent_task_id

  const commitTitle = () => {
    const next = title.trim()
    if (next && next !== task.title) void updateTask(task, { title: next })
  }
  const commitNotes = () => {
    const next = notes.trim() || null
    if (next !== task.notes) void updateTask(task, { notes: next })
  }
  const commitTags = async () => {
    const names = tagText
      .split(',')
      .map((t) => t.trim().replace(/^#/, '').toLowerCase())
      .filter(Boolean)
    const tags = await ensureTags(names)
    await setTaskTags(task.id, tags.map((t) => t.id))
  }

  async function addSubtask() {
    const text = subtaskText.trim()
    if (!text || !task) return
    await createTask({
      title: text,
      parent_task_id: task.id,
      list_id: task.list_id,
    })
    setSubtaskText('')
  }

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="font-mono text-2xs uppercase tracking-wide text-faint">
          {isSubtask ? 'Subtask' : 'Task'}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="btn-quiet px-2 py-1 text-p1"
            title="Delete task"
            onClick={() => {
              void deleteTask(task.id)
              onClose()
            }}
          >
            <TrashIcon size={15} />
          </button>
          <button type="button" className="btn-quiet px-2 py-1" onClick={onClose}>
            <CloseIcon size={16} />
          </button>
        </div>
      </header>

      <div className="scroll-thin flex-1 space-y-4 overflow-y-auto px-3 py-3">
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => void setTaskStatus(task, task.status !== 'done')}
            className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center"
            aria-label="Toggle done"
          >
            <span
              className={`flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 ${
                task.status === 'done'
                  ? 'border-accent bg-accent text-accent-fg'
                  : 'border-line text-transparent'
              }`}
            >
              <CheckIcon size={12} />
            </span>
          </button>
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            rows={2}
            className="field resize-none border-transparent bg-transparent px-1 py-0.5 text-base font-medium"
          />
        </div>

        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={commitNotes}
            rows={4}
            placeholder="Markdown"
            className="field font-mono text-xs"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Due date">
            <input
              type="date"
              value={task.due_date ?? ''}
              onChange={(e) =>
                void updateTask(task, {
                  due_date: e.target.value || null,
                  due_time: e.target.value ? task.due_time : null,
                })
              }
              className="field"
            />
          </Field>
          <Field label="Time">
            <input
              type="time"
              value={task.due_time?.slice(0, 5) ?? ''}
              disabled={!task.due_date}
              onChange={(e) =>
                void updateTask(task, {
                  due_time: e.target.value ? `${e.target.value}:00` : null,
                })
              }
              className="field disabled:opacity-40"
            />
          </Field>
        </div>

        <Field label="Priority">
          <div className="flex gap-1.5">
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => void updateTask(task, { priority: p.value })}
                className={`btn border px-2.5 py-1 text-xs ${
                  task.priority === p.value
                    ? `${p.tone} bg-surface2`
                    : 'border-line text-muted'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="List">
            <select
              value={task.list_id ?? ''}
              onChange={(e) =>
                void updateTask(task, { list_id: e.target.value || null })
              }
              className="field"
            >
              <option value="">Inbox</option>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              value={task.status}
              onChange={(e) =>
                void updateTask(task, {
                  status: e.target.value as TaskStatus,
                  completed_at:
                    e.target.value === 'done' ? new Date().toISOString() : null,
                })
              }
              className="field"
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {clients.length > 0 && (
          <Field label="Client">
            <select
              value={task.client_id ?? ''}
              onChange={(e) =>
                void updateTask(task, { client_id: e.target.value || null })
              }
              className="field"
            >
              <option value="">None</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Repeat">
          <RecurrencePicker task={task} onChange={(patch) => void updateTask(task, patch)} />
        </Field>

        <Field label="Tags">
          <input
            value={tagText}
            onChange={(e) => setTagText(e.target.value)}
            onBlur={() => void commitTags()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                e.currentTarget.blur()
              }
            }}
            placeholder="work, errands"
            className="field"
          />
        </Field>

        {!isSubtask && (
          <Field label={`Subtasks${children.length ? ` (${children.length})` : ''}`}>
            <ul className="mb-1.5 space-y-0.5">
              {children.map((child) => (
                <SubtaskRow key={child.id} task={child} />
              ))}
            </ul>
            <div className="flex items-center gap-1.5">
              <PlusIcon size={14} className="text-faint" />
              <input
                value={subtaskText}
                onChange={(e) => setSubtaskText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void addSubtask()
                  }
                }}
                placeholder="Add a subtask"
                className="field px-2 py-1 text-xs"
              />
            </div>
          </Field>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-2xs font-semibold uppercase tracking-wide text-faint">
        {label}
      </span>
      {children}
    </label>
  )
}

function SubtaskRow({ task }: { task: Task }) {
  const done = task.status === 'done'
  return (
    <li className="flex items-center gap-2 text-xs">
      <button
        type="button"
        onClick={() => void setTaskStatus(task, !done)}
        aria-label="Toggle subtask"
        className="flex h-6 w-6 shrink-0 items-center justify-center"
      >
        <span
          className={`flex h-[15px] w-[15px] items-center justify-center rounded-full border-2 ${
            done ? 'border-accent bg-accent text-accent-fg' : 'border-line text-transparent'
          }`}
        >
          <CheckIcon size={10} />
        </span>
      </button>
      <span className={`min-w-0 flex-1 truncate ${done ? 'text-faint line-through' : ''}`}>
        {task.title}
      </span>
      <button
        type="button"
        onClick={() => void deleteTask(task.id)}
        className="text-faint hover:text-p1"
        aria-label="Delete subtask"
      >
        <TrashIcon size={13} />
      </button>
    </li>
  )
}
