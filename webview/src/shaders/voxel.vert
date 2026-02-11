precision highp float;

uniform vec3 uVoxelShape;
uniform mat4 uModelMatrixInverse;

varying vec3 vOrigin;
varying vec3 vModelPosition;
varying vec3 vDirection;

void main() {
    vec4 position4 = vec4(position, 1.0);
    vec4 modelPosition = modelMatrix * position4;
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;

    gl_Position = projectedPosition;

    // world space origin and direction
    vOrigin = cameraPosition.xyz;
    vDirection = modelPosition.xyz - vOrigin;
    vModelPosition = modelPosition.xyz;
}
