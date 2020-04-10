import { Attribute } from './attribute'

export type Definition = {
  meta: ResourceDefinition
  attributes?: Attribute[]
}

export type Constraint = {
  key: string
  severity: string
  human: string
  expression: string
  xpath: string
  source: string
}

export type ResourceDefinition = {
  id: string
  url: string
  name: string
  type: string
  description: string
  kind: string
  baseDefinition: string
  derivation: string
  publisher: string
  min: string
  max: string
  context?: {
    type: string
    expression: string
  }[]
  constraint: Constraint[]
}

export type AttributeDefinition = {
  id: string
  path: string
  definition: string
  base: {
    path: string
  }
  min: number
  max: string
  type: any[]
  slicing?: any
  sliceName?: string
  constraint?: Constraint[]
}
