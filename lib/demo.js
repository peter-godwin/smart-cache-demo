import { SmartCache, memoize } from './index.js';

async function main() {
  const cache = new SmartCache({ defaultTTL: 5000 });

  cache.on('hit', d => console.log('HIT:', d.key));
  cache.on('miss', d => console.log('MISS:', d.key));
  cache.on('set', d => console.log('SET:', d.key));

  await cache.set('user:1', { name: 'Alice' }, { tags: ['user', 'profile'] });
  await cache.set('user:2', { name: 'Bob' }, { tags: ['user'] });
  await cache.set('config:theme', 'dark', { tags: ['config'] });

  const user1 = await cache.get('user:1');
  console.log('User 1:', user1);

  const user1Again = await cache.get('user:1');
  console.log('User 1 again:', user1Again);

  await cache.invalidateByTag('config');
  const theme = await cache.get('config:theme', () => 'default');
  console.log('Theme:', theme);

  await cache.set('api:users', []);
  await cache.set('api:posts', []);
  await cache.invalidateByPattern(/^api:/);

  console.log('\nMetrics:', cache.getMetrics());

  let calls = 0;
  const fetchUser = memoize(async (id) => {
    calls++;
    return { id, name: `User ${id}` };
  });

  await fetchUser(100);
  await fetchUser(100);
  console.log('fetchUser called', calls, 'time(s)');

  cache.destroy();
}

main().catch(console.error);
