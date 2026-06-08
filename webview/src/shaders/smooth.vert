precision highp float;

uniform vec3 uVoxelShape;
uniform mat4 uModelMatrixInverse;
uniform float uIsOrthographic;

varying vec3 vOrigin;
varying vec3 vModelPosition;
varying vec3 vDirection;

void main() {
    vec4 position4 = vec4(position, 1.0);
    vec4 modelPosition = modelMatrix * position4;
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;

    gl_Position = projectedPosition;

    vModelPosition = modelPosition.xyz;

    if (uIsOrthographic > 0.5) {
        vec3 cameraForward = -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
        float d = dot(modelPosition.xyz - cameraPosition, cameraForward);
        vOrigin = modelPosition.xyz - cameraForward * d;
        vDirection = cameraForward;
    } else {
        vOrigin = cameraPosition.xyz;
        vDirection = modelPosition.xyz - cameraPosition.xyz;
    }
}
