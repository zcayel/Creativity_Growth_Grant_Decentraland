import { Entity, GltfContainer, RaycastQueryType, Transform, engine, raycastSystem } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import { Sound } from './sound'
import { Dialog, NpcUtilsUi } from  'dcl-npc-toolkit'
import * as npc from 'dcl-npc-toolkit'





const victorySound = new Sound('sounds/complete.mp3', false)

export class ReflectedRay {
  public static instances: ReflectedRay[] = []

  public reflectedRayEntity: Entity | null = null

  constructor(modelPath: string, origin: Vector3, isSource: boolean = false) {
    this.reflectedRayEntity = engine.addEntity()
    GltfContainer.create(this.reflectedRayEntity, {
      src: modelPath
    })
    Transform.create(this.reflectedRayEntity, {
      position: origin
    })

    // Don't add the ray emitter source to the instances so that it doesn't get deleted
    if (!isSource) ReflectedRay.instances.push(this)
  }

  remove(): void {
    if (this.reflectedRayEntity === undefined || this.reflectedRayEntity === null) return

    engine.removeEntity(this.reflectedRayEntity)
  }

  static removeAll(): void {
    while (ReflectedRay.instances.length > 0) {
      const reflectedRay = ReflectedRay.instances.pop()
      if (reflectedRay !== undefined && reflectedRay !== null) reflectedRay.remove()
    }
  }
}

//Cage
const cage = engine.addEntity()
GltfContainer.create(cage, {
  src: 'models/cage.glb'
})
Transform.create(cage, {
  position: Vector3.create(22.5, 10.5, 23.5)
})

// Ray
const rayEmitter = engine.addEntity()
GltfContainer.create(rayEmitter, {
  src: 'models/rayEmitter.glb'
})
Transform.create(rayEmitter, {
  position: Vector3.create(15.5, 9, 10.5)
})

const rayTarget = engine.addEntity()
GltfContainer.create(rayTarget, {
  src: 'models/rayTarget.glb'
})
Transform.create(rayTarget, {
  position: Vector3.create(15.5, 9, 36.5)
})

const origin = Vector3.create(15.5, 13.5, 10.5)
const sourceRay = new ReflectedRay('models/rayOffsetY.glb', origin, true)

// Ray emitter
export function redrawRays(): void {
  raycastSystem.registerGlobalDirectionRaycast(
    {
      entity: rayEmitter,
      opts: {
        queryType: RaycastQueryType.RQT_HIT_FIRST,
        direction: Vector3.Forward(),
        originOffset: Vector3.subtract(origin, Transform.getMutable(rayEmitter).position),
        maxDistance: 100
      }
    },
    function (result) {
      // Delete previous ray models
      ReflectedRay.removeAll()
      if (
        result.hits &&
        result.hits.length > 0 &&
        result.hits[0] &&
        result.hits[0].position &&
        result.hits[0].normalHit
      ) {
        const hitPosition = result.hits[0].position
        const hitNormal: Vector3 = result.hits[0].normalHit
        const meshName: string | undefined = result.hits[0].meshName

        if (meshName === undefined || meshName === '') return

        if (meshName === 'mirror_collider') {
          const reflectedVector: Vector3 = reflectVector(
            Vector3.Forward(),
            Vector3.create(hitNormal.x, hitNormal.y, hitNormal.z)
          )
          reflectRay(Vector3.create(hitPosition.x, hitPosition.y, hitPosition.z), reflectedVector)
        }
        const distance = Vector3.distance(origin, hitPosition)
        let sourceRayTransform = Transform.getMutableOrNull(sourceRay.reflectedRayEntity as Entity)
        if (sourceRayTransform) {
          sourceRayTransform.scale.z = distance
        }
      }
    }
  )
}

// Recursive function for reflecting a ray every time it hits a mirror
function reflectRay(hitPoint: Vector3, reflectedVector: Vector3) {
  const reflectedRay = new ReflectedRay('models/rayOffsetY.glb', hitPoint)
  if (reflectedRay.reflectedRayEntity === undefined || reflectedRay.reflectedRayEntity === null) return

  const reflectedRayTransform = Transform.getMutable(reflectedRay.reflectedRayEntity)
  reflectedRayTransform.position = hitPoint

  const reflectedTarget = Vector3.add(hitPoint, reflectedVector)
  reflectedRayTransform.rotation = Quaternion.fromLookAt(hitPoint, reflectedTarget)

  raycastSystem.registerGlobalDirectionRaycast(
    {
      entity: reflectedRay.reflectedRayEntity,
      opts: {
        queryType: RaycastQueryType.RQT_HIT_FIRST,
        direction: reflectedVector,
        maxDistance: 100
      }
    },
    function (result) {
      if (
        result.hits &&
        result.hits.length > 0 &&
        result.hits[0] &&
        result.hits[0].position &&
        result.hits[0].normalHit
      ) {
        const hitPosition = result.hits[0].position
        const hitNormal: Vector3 = result.hits[0].normalHit
        const meshName: string | undefined = result.hits[0].meshName

        const distance = Vector3.distance(hitPoint, hitPosition)
        Transform.getMutable(reflectedRay.reflectedRayEntity as Entity).scale.z = distance

        if (meshName === 'mirror_collider') {
          const nextReflectedVector: Vector3 = reflectVector(
            Vector3.create(reflectedVector.x, reflectedVector.y, reflectedVector.z),
            Vector3.create(hitNormal.x, hitNormal.y, hitNormal.z)
          )
          reflectRay(Vector3.create(hitPosition.x, hitPosition.y, hitPosition.z), nextReflectedVector)
        } else if (meshName === 'rayTarget_collider') {
          console.log('You win') // Win condition
          victorySound.playAudio()
          
          //Remove Cage From Scene
          engine.removeEntity(cage)
          npc.talk(king, WinDialog)
        }
      }
    }
  )
}

//---------------KING----------------//
let king = npc.create(
  {
    position: Vector3.create(22.5, 10.5, 23.5),
    rotation: Quaternion.fromEulerDegrees(0, 180, 0),
    scale: Vector3.create(1, 1, 1)
  },
  {
    type: npc.NPCType.CUSTOM,
    model: {
    src: 'models/King.glb'
    },
    faceUser: true,
    reactDistance:  3,
    onActivate: () => {
    
      npc.talk(king, kingDialog)
      
    
    },
    continueOnWalkAway: false
  }
  )



  let kingDialog: Dialog[] = [
  {
  text: 'Hello, can you help me?',
  isEndOfDialog: false,
  },
  {
  text: 'To save me you have to target the ray to the receiver on the back.',
  isEndOfDialog: false,
  },
  {
  text: 'Move and adjust the morrion to create a reflection.',
  isEndOfDialog: false,
  },
  {
  text: 'Please save this old man',
  isEndOfDialog: true,
  },

  ]
  
  let WinDialog: Dialog[] = [
    
    {
    text: 'Thank you for saving me',
    isEndOfDialog: true,
    },
    {
      text: 'Well done!',
      isEndOfDialog: true,
      },
  ]
  



// Put in the direction of the previous ray and the normal of the raycast's hitpoint
function reflectVector(incident: Vector3, normal: Vector3): Vector3 {
  const dot = 2 * Vector3.dot(incident, normal)
  const reflected = Vector3.subtract(incident, Vector3.multiplyByFloats(normal, dot, dot, dot))
  return reflected
}