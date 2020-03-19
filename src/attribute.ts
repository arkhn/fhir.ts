import { AttributeDefinition } from 'types'

const toCamelCase = (s: string) => s[0].toUpperCase() + s.slice(1)

const PRIMITIVE_TYPES = [
  'base64Binary',
  'boolean',
  'canonical',
  'code',
  'date',
  'dateTime',
  'decimal',
  'id',
  'instant',
  'integer',
  'markdown',
  'oid',
  'positiveInt',
  'string',
  'time',
  'unsignedInt',
  'uri',
  'url',
  'uuid',
  'xhtml',
]

export class Attribute {
  parent?: Attribute
  children: Attribute[]
  slices: Attribute[]

  name: string
  isArray: boolean
  isSlice: boolean
  isRequired: boolean
  isPrimitive: boolean
  definition: AttributeDefinition
  types: string[]
  index?: number

  constructor(definition: AttributeDefinition, index?: number) {
    this.children = []
    this.slices = []

    this.definition = definition
    this.name = definition.id.split('.').pop()!
    this.index = index
    this.isArray = index === undefined && definition.max !== '1'
    this.isSlice = !!definition.sliceName
    this.isRequired = definition.min > 0

    this.types = definition.type
      ? definition.type.map((type: any) => type.code)
      : []

    this.isPrimitive =
      this.types.length > 1
        ? false
        : PRIMITIVE_TYPES.includes(this.types[0])
        ? true
        : false
  }

  get isReferenceType(): boolean {
    return this.types[0] === 'uri' && this.parent?.types[0] === 'Reference'
  }

  addChild(child: Attribute) {
    child.parent = this
    this.children.push(child)
  }

  addSlice(slice: Attribute) {
    slice.parent = this.parent
    this.slices.push(slice)
  }

  toJSON() {
    return { ...this, parent: undefined }
  }

  equals(p: Attribute) {
    return this.serialize() === p.serialize()
  }

  tail(): string {
    // if element has an index, return the index in brackets
    if (this.parent?.isArray) return `[${this.index || 0}]`

    if (this.definition.sliceName && this.parent?.name.includes('[x]')) {
      return this.definition.sliceName
    }

    // if the parent has multiple types, use the type in camelCase
    if (this.parent && this.parent.types.length > 1)
      return this.name.replace('[x]', toCamelCase(this.definition.type[0].code))

    return this.name || ''
  }

  serialize(): string {
    // if not parent, return the definitionId
    if (!this.parent) {
      return this.tail()
    }

    if (this.parent.isArray) {
      return `${this.parent.serialize()}${this.tail()}`
    }

    // if parent is a multi-type attribute, we don't want to render the parent
    if (
      this.parent.types.length > 1 ||
      (this.parent.definition.slicing && this.parent.name.includes('[x]'))
    ) {
      return this.parent.parent
        ? `${this.parent.parent.serialize()}.${this.tail()}`
        : this.tail()
    }

    // else, join the parent to the current element with a '.'
    return `${this.parent.serialize()}.${this.tail()}`
  }
}
