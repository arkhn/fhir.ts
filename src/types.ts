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
  constraint: Constraint[]
}

export type AttributeDefinition = {
  id: string
  path: string
  definition: any
  min: number
  max: string
  type: any[]
  slicing: any
  sliceName: string
  constraint: Constraint[]
}