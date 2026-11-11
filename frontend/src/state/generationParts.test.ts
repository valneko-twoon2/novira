import { afterEach, describe, expect, it } from 'vitest';
import { generationMetadata } from './generationParts';
import { useParams } from './params';

const initial = useParams.getState();
afterEach(() => useParams.setState(initial, true));

describe('generationMetadata', () => {
  it('sends the sampler and noise schedule only when one was picked', { tags: ['condition'] }, () => {
    useParams.setState({ samplerName: null, noiseSchedule: null });
    const plain = generationMetadata('txt2img');
    expect('samplerName' in plain).toBe(false);
    expect('noiseSchedule' in plain).toBe(false);
    useParams.setState({ samplerName: 'res_multistep', noiseSchedule: 'karras' });
    expect(generationMetadata('txt2img')).toMatchObject({ samplerName: 'res_multistep', noiseSchedule: 'karras' });
    useParams.setState({ noiseSchedule: null });
    const onlySampler = generationMetadata('img2img');
    expect(onlySampler.samplerName).toBe('res_multistep');
    expect('noiseSchedule' in onlySampler).toBe(false);
  });
});
