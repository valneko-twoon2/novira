// The page the assistant looks at: drawn like a saved page, stored as an intermediate picture, and refused with a reason
// when there is nothing drawn to see.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { backend } from '@/backend';
import { newProject } from '@/state/comic/document';
import { useComic } from '@/state/comic/store';
import { viewComicPage } from './agentView';

const render = vi.hoisted(() => vi.fn(async () => new Blob(['jpeg'])));
vi.mock('./pageRender', () => ({ renderPage: render }));

beforeEach(() => {
  render.mockClear();
  const project = newProject('View');
  useComic.setState({ projects: [project], activeProjectId: project.id });
});

describe('viewComicPage', () => {
  it('stores the drawn page as an intermediate JPEG picture and gives its name', async () => {
    const project = useComic.getState().projects[0]!;
    project.pages[0]!.panels[0]!.imageName = 'panel.png';
    useComic.setState({ projects: [{ ...project }] });
    const upload = vi.spyOn(backend, 'uploadImage').mockResolvedValue({ name: 'seen.jpg' } as never);
    expect(await viewComicPage(1)).toBe('seen.jpg');
    expect(render).toHaveBeenCalledWith(expect.anything(), expect.any(Function), 'jpeg', expect.anything());
    expect(upload).toHaveBeenCalledWith(expect.any(Blob), expect.objectContaining({ isIntermediate: true }));
  });

  it('says why when the page is missing, undrawn, or no comic is open', async () => {
    await expect(viewComicPage(5)).rejects.toThrow('there is no page 5');
    await expect(viewComicPage(1)).rejects.toThrow('no drawn panel');
    useComic.setState({ projects: [], activeProjectId: null });
    await expect(viewComicPage(1)).rejects.toThrow('No comic is open');
    expect(render).not.toHaveBeenCalled();
  });
});
