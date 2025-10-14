<!-- eslint-disable -->
<script setup lang="ts" generic="TData">
import type { ColumnDef, SortingState } from '@tanstack/vue-table'
import {
  FlexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useVueTable
} from '@tanstack/vue-table'
import { computed, ref } from 'vue'

import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'

const props = withDefaults(
  defineProps<{
    data: TData[]
    columns: ColumnDef<TData, any>[]
    paginator?: boolean
    rows?: number
    rowsPerPageOptions?: number[]
    exportFilename?: string
    class?: string
  }>(),
  {
    paginator: false,
    rows: 10,
    rowsPerPageOptions: () => [10, 20, 30, 50],
    exportFilename: 'export.csv'
  }
)

const sorting = ref<SortingState>([])
const pageSize = ref(props.rows)

const table = useVueTable({
  get data() {
    return props.data
  },
  get columns() {
    return props.columns
  },
  state: {
    get sorting() {
      return sorting.value
    },
    get pagination() {
      return {
        pageIndex: 0,
        pageSize: pageSize.value
      }
    }
  },
  onSortingChange: (updaterOrValue) => {
    sorting.value =
      typeof updaterOrValue === 'function' ? updaterOrValue(sorting.value) : updaterOrValue
  },
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getPaginationRowModel: props.paginator ? getPaginationRowModel() : undefined
})

function exportCSV() {
  const columnsWithAccessor = props.columns.filter(
    (col) => 'accessorKey' in col && col.accessorKey
  ) as Array<ColumnDef<TData, any> & { accessorKey: keyof TData }>

  const headers = columnsWithAccessor
    .map((col) =>
      'header' in col && typeof col.header === 'string' ? col.header : String(col.accessorKey)
    )
    .join(',')

  const rows = props.data
    .map((row) => {
      return columnsWithAccessor
        .map((col) => {
          const value = row[col.accessorKey]
          const stringValue = String(value ?? '')
          return stringValue.includes(',') ? `"${stringValue}"` : stringValue
        })
        .join(',')
    })
    .join('\n')

  const csv = `${headers}\n${rows}`
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = props.exportFilename
  link.click()
  URL.revokeObjectURL(url)
}

defineExpose({ exportCSV })
</script>

<template>
  <div :class="cn('space-y-4', props.class)">
    <slot name="header" />

    <div class="rounded-md border border-zinc-200 dark:border-zinc-700">
      <Table>
        <TableHeader>
          <TableRow
            v-for="headerGroup in table.getHeaderGroups()"
            :key="headerGroup.id"
            class="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <TableHead
              v-for="header in headerGroup.headers"
              :key="header.id"
              :class="
                cn(
                  'px-4 py-3 text-left text-sm font-medium text-zinc-700 dark:text-zinc-300',
                  header.column.getCanSort() &&
                    'cursor-pointer select-none hover:bg-zinc-100 dark:hover:bg-zinc-800'
                )
              "
              @click="header.column.getToggleSortingHandler()?.($event)"
            >
              <div class="flex items-center gap-2">
                <FlexRender
                  v-if="!header.isPlaceholder"
                  :render="header.column.columnDef.header"
                  :props="header.getContext()"
                />
                <span v-if="header.column.getCanSort()" class="text-xs opacity-50">
                  {{
                    header.column.getIsSorted() === 'asc'
                      ? '↑'
                      : header.column.getIsSorted() === 'desc'
                        ? '↓'
                        : '↕'
                  }}
                </span>
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="table.getRowModel().rows.length">
            <TableRow
              v-for="row in table.getRowModel().rows"
              :key="row.id"
              class="border-b border-zinc-200 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              <TableCell
                v-for="cell in row.getVisibleCells()"
                :key="cell.id"
                class="px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100"
              >
                <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
              </TableCell>
            </TableRow>
          </template>
          <template v-else>
            <TableRow>
              <TableCell :colspan="table.getAllColumns().length" class="h-24 text-center">
                <slot name="empty">
                  <div class="p-4 text-zinc-500 dark:text-zinc-400">No data</div>
                </slot>
              </TableCell>
            </TableRow>
          </template>
        </TableBody>
      </Table>
    </div>

    <div v-if="paginator" class="flex items-center justify-between px-2">
      <div class="flex items-center gap-2">
        <span class="text-sm text-zinc-700 dark:text-zinc-300">Rows per page:</span>
        <Select
          :model-value="pageSize.toString()"
          @update:model-value="
            (value) => {
              pageSize = Number(value)
              table.setPageSize(Number(value))
            }
          "
        >
          <SelectTrigger class="h-8 w-[70px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="size in rowsPerPageOptions" :key="size" :value="size.toString()">
              {{ size }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="flex items-center gap-2">
        <span class="text-sm text-zinc-700 dark:text-zinc-300">
          Page {{ table.getState().pagination.pageIndex + 1 }} of {{ table.getPageCount() }}
        </span>
        <div class="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            :disabled="!table.getCanPreviousPage()"
            @click="table.previousPage()"
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            :disabled="!table.getCanNextPage()"
            @click="table.nextPage()"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
