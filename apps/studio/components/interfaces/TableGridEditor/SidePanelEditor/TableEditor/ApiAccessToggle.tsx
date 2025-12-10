import type { PostgresTable } from '@supabase/postgres-meta'
import Link from 'next/link'
import { useEffect, useMemo } from 'react'

import { useParams } from 'common'
import { useProjectPostgrestConfigQuery } from 'data/config/project-postgrest-config-query'
import { useTableApiAccessQuery } from 'data/privileges/table-api-access-query'
import { useQuerySchemaState } from 'hooks/misc/useSchemaQueryState'
import { useSelectedProjectQuery } from 'hooks/misc/useSelectedProject'
import { Switch } from 'ui'
import { Admonition } from 'ui-patterns'
import { InfoTooltip } from 'ui-patterns/info-tooltip'

import type { TableField } from './TableEditor.types'

interface ApiAccessToggleProps {
  table?: PostgresTable
  tableFields: TableField
  isNewRecord: boolean
  isDuplicating: boolean
  onChange?: (value: boolean) => void
  onInitialLoad?: (value: boolean) => void
}

export const ApiAccessToggle = ({
  table,
  tableFields,
  isNewRecord,
  isDuplicating,
  onChange,
  onInitialLoad,
}: ApiAccessToggleProps) => {
  const { ref: projectRef } = useParams()
  const { data: project } = useSelectedProjectQuery()
  const { selectedSchema } = useQuerySchemaState()

  const { name: tableName } = tableFields
  const schema = table?.schema ?? selectedSchema
  const relationId = table?.id ?? tableFields.id

  const { data: postgrestConfig } = useProjectPostgrestConfigQuery({ projectRef })

  const exposedSchemas = useMemo(() => {
    if (!postgrestConfig?.db_schema) return []
    return postgrestConfig.db_schema.replace(/ /g, '').split(',')
  }, [postgrestConfig?.db_schema])

  const isSchemaExposed = exposedSchemas.includes(schema)

  const { data: apiAccessData, isLoading: isApiAccessLoading } = useTableApiAccessQuery(
    {
      projectRef: project?.ref,
      connectionString: project?.connectionString,
      relationId,
      schema,
      tableName,
    },
    { enabled: !isNewRecord && !isDuplicating }
  )

  const derivedApiAccessEnabled =
    tableFields.isApiAccessEnabled ?? apiAccessData?.hasApiAccess ?? true

  useEffect(() => {
    if (
      typeof apiAccessData?.hasApiAccess === 'boolean' &&
      tableFields.isApiAccessEnabled === undefined
    ) {
      onInitialLoad?.(apiAccessData.hasApiAccess)
    }
  }, [apiAccessData?.hasApiAccess, onInitialLoad, tableFields.isApiAccessEnabled])

  // For new records or duplicating, the query is disabled so we don't need to wait for loading
  const isLoadingState = !isNewRecord && !isDuplicating && isApiAccessLoading
  const isDisabled = isLoadingState || !isSchemaExposed

  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-foreground flex items-center gap-1.5">
            Expose table via Data API
            <InfoTooltip side="top" className="max-w-80">
              This controls whether the <code className="text-xs">anon</code> and{' '}
              <code className="text-xs">authenticated</code> roles have access to this table. When
              disabled, select privileges are revoked from these roles, making the table
              inaccessible via the Data API.
            </InfoTooltip>
          </p>
          <p className="text-sm text-foreground-lighter">
            Disabling will make this table inaccessible via Supabase client libraries like
            supabase-js
          </p>
        </div>
        <Switch
          size="large"
          disabled={isDisabled}
          checked={isSchemaExposed && derivedApiAccessEnabled}
          onCheckedChange={(value) => onChange?.(value)}
        />
      </div>
      {!isSchemaExposed && (
        <Admonition
          type="default"
          title={`The "${schema}" schema is not exposed via the Data API`}
          description={
            <>
              To enable API access for this table, you need to first expose the{' '}
              <code className="text-xs">{schema}</code> schema in your{' '}
              <Link
                href={`/project/${projectRef}/settings/api`}
                className="text-foreground hover:underline"
              >
                API settings
              </Link>
              .
            </>
          }
        />
      )}
    </div>
  )
}
