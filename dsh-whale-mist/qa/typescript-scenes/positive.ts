import {SCENES, isSceneId, sceneSelection, resolveSceneRequest, describeScenes} from './scenes.js';

function inspect(value: unknown) {
  const shape: boolean = isSceneId(value);
  const selection = sceneSelection(value);
  const id: string = selection.sceneId;
  const unvalidatedMode: unknown = selection.mode;
  const request = resolveSceneRequest(value);
  const mode: 'preview' | 'daily' = request.mode;
  const seconds: number | null = request.seconds;
  const project: string = request.project;
  const width: number = request.width;
  void [shape, id, unvalidatedMode, mode, seconds, project, width];
}
isSceneId();
sceneSelection();
resolveSceneRequest();
inspect(undefined);
inspect({scene: 7, mode: 'not-validated'});
const scenes = {custom: {id: 'custom', label: 'Custom', project: 'fixture'},
  verified: {id: 'verified', label: 'Verified', project: 'fixture', playbackVerified: true}};
resolveSceneRequest({scene: 'custom'}, {scenes, exists(project) { const input: string = project; return input === 'fixture'; }});
resolveSceneRequest({scene: 'lucy'}, {resolveProject(id) { const input: string = id; return input; }});
// An injected resolver is a trust boundary. Bad results are permitted as unknown, then refused at runtime.
resolveSceneRequest({}, {resolveProject: () => 7});
resolveSceneRequest({}, {resolveProject: null});
for (const row of describeScenes({scenes, exists: () => true})) {
  const available: boolean = row.available;
  const verified: boolean = row.playbackVerified;
  const path: string = row.project;
  void [available, verified, path];
}
const defaultPath: string = SCENES.lucy.project;
void defaultPath;
