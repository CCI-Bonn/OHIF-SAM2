"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@cornerstonejs/core");
const gl_matrix_1 = require("gl-matrix");
const AnnotationDisplayTool_1 = __importDefault(require("./AnnotationDisplayTool"));
const annotationLocking_1 = require("../../stateManagement/annotation/annotationLocking");
const annotationVisibility_1 = require("../../stateManagement/annotation/annotationVisibility");
const annotationState_1 = require("../../stateManagement/annotation/annotationState");
const state_1 = require("../../stateManagement/annotation/helpers/state");
class AnnotationTool extends AnnotationDisplayTool_1.default {
    constructor(toolProps, defaultToolProps) {
        var _a, _b;
        super(toolProps, defaultToolProps);
        this.mouseMoveCallback = (evt, filteredAnnotations) => {
            if (!filteredAnnotations) {
                return false;
            }
            const { element, currentPoints } = evt.detail;
            const canvasCoords = currentPoints.canvas;
            let annotationsNeedToBeRedrawn = false;
            for (const annotation of filteredAnnotations) {
                if ((0, annotationLocking_1.isAnnotationLocked)(annotation) ||
                    !(0, annotationVisibility_1.isAnnotationVisible)(annotation.annotationUID)) {
                    continue;
                }
                const { data } = annotation;
                const activateHandleIndex = data.handles
                    ? data.handles.activeHandleIndex
                    : undefined;
                const near = this._imagePointNearToolOrHandle(element, annotation, canvasCoords, 6);
                const nearToolAndNotMarkedActive = near && !annotation.highlighted;
                const notNearToolAndMarkedActive = !near && annotation.highlighted;
                if (nearToolAndNotMarkedActive || notNearToolAndMarkedActive) {
                    annotation.highlighted = !annotation.highlighted;
                    annotationsNeedToBeRedrawn = true;
                }
                else if (data.handles &&
                    data.handles.activeHandleIndex !== activateHandleIndex) {
                    annotationsNeedToBeRedrawn = true;
                }
            }
            return annotationsNeedToBeRedrawn;
        };
        if ((_a = toolProps.configuration) === null || _a === void 0 ? void 0 : _a.getTextLines) {
            this.configuration.getTextLines = toolProps.configuration.getTextLines;
        }
        if ((_b = toolProps.configuration) === null || _b === void 0 ? void 0 : _b.statsCalculator) {
            this.configuration.statsCalculator =
                toolProps.configuration.statsCalculator;
        }
    }
    static createAnnotation(...annotationBaseData) {
        let annotation = {
            annotationUID: null,
            highlighted: true,
            invalidated: true,
            metadata: {
                toolName: this.toolName,
            },
            data: {
                text: '',
                handles: {
                    points: new Array(),
                    textBox: {
                        hasMoved: false,
                        worldPosition: [0, 0, 0],
                        worldBoundingBox: {
                            topLeft: [0, 0, 0],
                            topRight: [0, 0, 0],
                            bottomLeft: [0, 0, 0],
                            bottomRight: [0, 0, 0],
                        },
                    },
                },
                label: '',
            },
        };
        for (const baseData of annotationBaseData) {
            annotation = core_1.utilities.deepMerge(annotation, baseData);
        }
        return annotation;
    }
    static createAnnotationForViewport(viewport, ...annotationBaseData) {
        return this.createAnnotation({ metadata: viewport.getViewReference() }, ...annotationBaseData);
    }
    static createAndAddAnnotation(viewport, ...annotationBaseData) {
        const annotation = this.createAnnotationForViewport(viewport, ...annotationBaseData);
        (0, annotationState_1.addAnnotation)(annotation, viewport.element);
        (0, state_1.triggerAnnotationModified)(annotation, viewport.element);
    }
    getHandleNearImagePoint(element, annotation, canvasCoords, proximity) {
        const enabledElement = (0, core_1.getEnabledElement)(element);
        const { viewport } = enabledElement;
        const { data } = annotation;
        const { isCanvasAnnotation } = data;
        const { points, textBox } = data.handles;
        if (textBox) {
            const { worldBoundingBox } = textBox;
            if (worldBoundingBox) {
                const canvasBoundingBox = {
                    topLeft: viewport.worldToCanvas(worldBoundingBox.topLeft),
                    topRight: viewport.worldToCanvas(worldBoundingBox.topRight),
                    bottomLeft: viewport.worldToCanvas(worldBoundingBox.bottomLeft),
                    bottomRight: viewport.worldToCanvas(worldBoundingBox.bottomRight),
                };
                if (canvasCoords[0] >= canvasBoundingBox.topLeft[0] &&
                    canvasCoords[0] <= canvasBoundingBox.bottomRight[0] &&
                    canvasCoords[1] >= canvasBoundingBox.topLeft[1] &&
                    canvasCoords[1] <= canvasBoundingBox.bottomRight[1]) {
                    data.handles.activeHandleIndex = null;
                    return textBox;
                }
            }
        }
        for (let i = 0; i < (points === null || points === void 0 ? void 0 : points.length); i++) {
            const point = points[i];
            const annotationCanvasCoordinate = isCanvasAnnotation
                ? point.slice(0, 2)
                : viewport.worldToCanvas(point);
            const near = gl_matrix_1.vec2.distance(canvasCoords, annotationCanvasCoordinate) < proximity;
            if (near === true) {
                data.handles.activeHandleIndex = i;
                return point;
            }
        }
        data.handles.activeHandleIndex = null;
    }
    getLinkedTextBoxStyle(specifications, annotation) {
        return {
            visibility: this.getStyle('textBoxVisibility', specifications, annotation),
            fontFamily: this.getStyle('textBoxFontFamily', specifications, annotation),
            fontSize: this.getStyle('textBoxFontSize', specifications, annotation),
            color: this.getStyle('textBoxColor', specifications, annotation),
            shadow: this.getStyle('textBoxShadow', specifications, annotation),
            background: this.getStyle('textBoxBackground', specifications, annotation),
            lineWidth: this.getStyle('textBoxLinkLineWidth', specifications, annotation),
            lineDash: this.getStyle('textBoxLinkLineDash', specifications, annotation),
        };
    }
    isSuvScaled(viewport, targetId, imageId) {
        var _a;
        if (viewport instanceof core_1.BaseVolumeViewport) {
            const volumeId = core_1.utilities.getVolumeId(targetId);
            const volume = core_1.cache.getVolume(volumeId);
            return ((_a = volume === null || volume === void 0 ? void 0 : volume.scaling) === null || _a === void 0 ? void 0 : _a.PT) !== undefined;
        }
        const scalingModule = imageId && core_1.metaData.get('scalingModule', imageId);
        return typeof (scalingModule === null || scalingModule === void 0 ? void 0 : scalingModule.suvbw) === 'number';
    }
    getAnnotationStyle(context) {
        const { annotation, styleSpecifier } = context;
        const getStyle = (property) => this.getStyle(property, styleSpecifier, annotation);
        const { annotationUID } = annotation;
        const visibility = (0, annotationVisibility_1.isAnnotationVisible)(annotationUID);
        const locked = (0, annotationLocking_1.isAnnotationLocked)(annotation);
        const lineWidth = getStyle('lineWidth');
        const lineDash = getStyle('lineDash');
        let color = getStyle('color');
        if (annotation.metadata.toolName === 'Probe2') {
            color = 'rgb(255, 0, 0)';
        }
        const shadow = getStyle('shadow');
        const textboxStyle = this.getLinkedTextBoxStyle(styleSpecifier, annotation);
        return {
            visibility,
            locked,
            color,
            lineWidth,
            lineDash,
            lineOpacity: 1,
            fillColor: color,
            fillOpacity: 0,
            shadow,
            textbox: textboxStyle,
        };
    }
    _imagePointNearToolOrHandle(element, annotation, canvasCoords, proximity) {
        const handleNearImagePoint = this.getHandleNearImagePoint(element, annotation, canvasCoords, proximity);
        if (handleNearImagePoint) {
            return true;
        }
        const toolNewImagePoint = this.isPointNearTool(element, annotation, canvasCoords, proximity, 'mouse');
        if (toolNewImagePoint) {
            return true;
        }
    }
}
AnnotationTool.toolName = 'AnnotationTool';
exports.default = AnnotationTool;
//# sourceMappingURL=AnnotationTool.js.map
