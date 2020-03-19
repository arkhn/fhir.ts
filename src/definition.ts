import { Attribute } from './attribute'
import { ResourceDefinition, Definition, AttributeDefinition } from 'types'

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

export const isSliceOf = (
  slice: AttributeDefinition,
  attr: AttributeDefinition,
): boolean => {
  return slice.path === attr.path && !!slice.sliceName
}

export const isChildOf = (
  child: AttributeDefinition,
  parent: AttributeDefinition,
): boolean => {
  const parentPath = parent.path.split('.').slice(1)
  const attrPath = child.path.split('.').slice(1)
  return JSON.stringify(attrPath.slice(0, -1)) === JSON.stringify(parentPath)
}

export const structurize = (fhirDefinition: {
  [k: string]: any
}): Definition => {
  if (!fhirDefinition.snapshot || !fhirDefinition.snapshot.element.length) {
    throw new Error('Snapshot is needed in the structure definition.')
  }

  const buildMetadata = (): ResourceDefinition => {
    const res = {} as ResourceDefinition

    // Build the metadata structure on the definition object
    for (const property of metaProperties) {
      if (!fhirDefinition[property]) {
        console.warn(`Missing property ${property} in StructureDefinition`)
      }
      res[property] = fhirDefinition[property]
    }

    // Extract the cardinality and constraints from the first element of the snapshot
    for (const property of rootProperties) {
      if (!fhirDefinition.snapshot.element[0][property]) {
        console.warn(`Missing property ${property} in first snapshot attribute`)
      }
      res[property] = fhirDefinition.snapshot.element[0][property]
    }
    return res
  }

  const buildProperties = (): Attribute[] => {
    // Iterate on the rest of the snapshot elements and add the properties on the definition object
    // Note that we filter out the properties which are inherited from different resources (Resource, DomainResource...)
    const recBuildProperties = (
      attributes: AttributeDefinition[],
      res: Attribute[],
      current?: Attribute,
    ): Attribute[] => {
      const [next, ...rest] = attributes

      // if the list of snapshot elements is over, return the attribute list
      if (!next) {
        return res
      }

      if (current) {
        if (isSliceOf(next, current.definition)) {
          const slice = new Attribute(next)
          current.addSlice(slice)
          // keep iterating on the snapshot elements using the slice attribute as current
          return recBuildProperties(rest, res, slice)
        }

        // try to add the next attribute as child of the current one
        if (isChildOf(next, current.definition)) {
          const child = new Attribute(next)
          current.addChild(child)
          // keep iterating on the snapshot elements using the new child attribute as current
          return recBuildProperties(rest, res, child)
        }

        // if next is not a children of current, try with the parent of current
        return recBuildProperties([next, ...rest], res, current.parent)
      }

      // if there is no current attribute, append the attribute to the attributes list
      const attr = new Attribute(next)
      res.push(attr)

      return recBuildProperties(rest, res, attr)
    }

    // Build the attributes ignoring the first element of the snapshot (which is not an actual attribute)
    const cleanedSnapshot = fhirDefinition.snapshot.element.slice(1)
    return recBuildProperties(cleanedSnapshot, [])
  }

  // If the structure defines a primitive type (one which we don't need to unroll in UI)
  // we don't need additional properties, we only need the definition metadata.
  if (fhirDefinition.kind === 'primitive-type')
    return {
      meta: buildMetadata(),
    }

  return {
    meta: buildMetadata(),
    attributes: buildProperties(),
  }
}
