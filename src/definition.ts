import { Attribute } from './attribute'
import { ResourceDefinition, Definition, AttributeDefinition } from './types'

const rootProperties: (keyof ResourceDefinition)[] = [
  'min',
  'max',
  'constraint',
]
const metaProperties: (keyof ResourceDefinition)[] = [
  'id',
  'url',
  'name',
  'type',
  'description',
  'kind',
  'baseDefinition',
  'derivation',
  'publisher',
]

const extensionMetaProperties: (keyof ResourceDefinition)[] = ['context']

const omittedResources = [
  'Element',
  'BackboneElement',
  'Resource',
  'DomainResource',
]
const allowedAttributes = ['extension']

export const isChoiceOf = (
  choice: AttributeDefinition,
  attr: AttributeDefinition,
): boolean =>
  choice.path === attr.path && !!choice.sliceName && choice.path.endsWith('[x]')

export const isSliceOf = (
  slice: AttributeDefinition,
  attr: AttributeDefinition,
): boolean => slice.path === attr.path && !!slice.sliceName && !attr.sliceName

export const isChildOf = (
  child: AttributeDefinition,
  parent: AttributeDefinition,
): boolean =>
  child.path.substring(0, child.path.lastIndexOf('.')) === parent.path

const shouldOmit = (attribute: AttributeDefinition): boolean => {
  const parsedPath: string[] = attribute.base.path.split('.')

  // if the attribute is whitelisted, it should not be omitted
  const attributeTail = parsedPath.slice().pop()!
  if (allowedAttributes.includes(attributeTail)) return false

  // if the base resource is blacklisted, it should be omitted
  const baseResource = parsedPath[0]
  return omittedResources.includes(baseResource)
}

export const structurize = (fhirDefinition: {
  [k: string]: any
}): Definition => {
  if (!fhirDefinition.snapshot || !fhirDefinition.snapshot.element.length) {
    throw new Error('Snapshot is needed in the structure definition.')
  }

  const buildMetadata = (): ResourceDefinition => {
    const res = {} as ResourceDefinition

    const fill = (property: keyof ResourceDefinition) => {
      if (!fhirDefinition[property]) {
        console.warn(
          `[${fhirDefinition.id}] Missing property ${property} in StructureDefinition`,
        )
      }
      res[property] = fhirDefinition[property]
    }

    // Build the metadata structure on the definition object
    metaProperties.forEach(fill)

    // Add the metadata extension fields in case the definition is an extension.
    if (
      fhirDefinition.type === 'Extension' &&
      fhirDefinition.derivation === 'constraint'
    ) {
      extensionMetaProperties.forEach(fill)
    }

    // Extract the cardinality and constraints from the first element of the snapshot
    for (const property of rootProperties) {
      if (fhirDefinition.snapshot.element[0][property] === undefined) {
        console.warn(
          `[${fhirDefinition.id}] Missing property ${property} in first snapshot attribute`,
        )
      }
      res[property] = fhirDefinition.snapshot.element[0][property]
    }
    return res
  }

  const buildAttributes = (): Attribute[] => {
    // Iterate on the rest of the snapshot elements and add the properties on the definition object
    // Note that we filter out the properties which are inherited from different resources (Resource, DomainResource...)
    const recBuildAttributes = (
      attributes: AttributeDefinition[],
      res: Attribute[],
      previous?: Attribute,
    ): Attribute[] => {
      const [current, ...rest] = attributes

      // if the list of snapshot elements is over, return the attribute list
      if (!current) {
        return res
      }

      // if the attribute is inherited from a generic resource (Element, Resource, DomainResource)
      // we want to ignore it
      if (shouldOmit(current)) {
        return recBuildAttributes(rest, res, previous)
      }

      if (previous) {
        if (isChoiceOf(current, previous.definition)) {
          const type = new Attribute(current)
          previous.addChoice(type)
          // keep iterating on the snapshot elements using the type attribute as previous
          return recBuildAttributes(rest, res, type)
        }

        if (isSliceOf(current, previous.definition)) {
          const slice = new Attribute(current)
          previous.addSlice(slice)
          // keep iterating on the snapshot elements using the slice attribute as previous
          return recBuildAttributes(rest, res, slice)
        }

        // try to add the current attribute as child of the previous one
        if (isChildOf(current, previous.definition)) {
          const child = new Attribute(current)
          previous.addChild(child)
          // keep iterating on the snapshot elements using the new child attribute as previous
          return recBuildAttributes(rest, res, child)
        }

        // if current is not a children of previous, try with the parent of previous
        return recBuildAttributes(attributes, res, previous.parent)
      }

      // if there is no previous attribute, append the attribute to the attributes list
      const attr = new Attribute(current)
      res.push(attr)

      return recBuildAttributes(rest, res, attr)
    }

    // Build the attributes ignoring the first element of the snapshot (which is not an actual attribute)
    const cleanedSnapshot = fhirDefinition.snapshot.element.slice(1)
    return recBuildAttributes(cleanedSnapshot, [])
  }

  // If the structure defines a primitive type (one which we don't need to unroll in UI)
  // we don't need additional properties, we only need the definition metadata.
  if (fhirDefinition.kind === 'primitive-type')
    return {
      meta: buildMetadata(),
    }

  return {
    meta: buildMetadata(),
    attributes: buildAttributes(),
  }
}
