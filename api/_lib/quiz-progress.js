export function calculateUnlockedLevel(profileLevel, attempts = []) {
  const passedLevels = new Set(
    (attempts || [])
      .filter((attempt) => attempt?.passed)
      .map((attempt) => Number(attempt.level))
      .filter((level) => Number.isInteger(level) && level >= 1 && level <= 20),
  );

  let highestSequentialPass = 0;
  for (let level = 1; level <= 20; level += 1) {
    if (!passedLevels.has(level)) break;
    highestSequentialPass = level;
  }

  const derivedLevel = highestSequentialPass >= 20 ? 20 : highestSequentialPass + 1;
  const normalizedProfileLevel = Number.isFinite(Number(profileLevel))
    ? Math.max(1, Math.min(20, Math.floor(Number(profileLevel))))
    : 1;

  return Math.max(normalizedProfileLevel, derivedLevel);
}

export async function reconcileQuizProfileLevel(sb, userId, profile) {
  if (!sb || !userId || !profile) {
    return profile;
  }

  const { data: attempts, error: attemptsError } = await sb
    .from('quiz_attempts')
    .select('level, passed')
    .eq('user_id', userId)
    .order('submitted_at', { ascending: false });

  if (attemptsError) throw attemptsError;

  const unlockedLevel = calculateUnlockedLevel(profile.current_level, attempts || []);
  if (unlockedLevel <= Number(profile.current_level || 1)) {
    return {
      ...profile,
      current_level: Math.max(1, Math.min(20, Number(profile.current_level || 1))),
    };
  }

  const { data: updated, error: updateError } = await sb
    .from('quiz_profiles')
    .update({ current_level: unlockedLevel, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select('*')
    .single();

  if (updateError) {
    const message = String(updateError.message || '');
    if (updateError.code === '23514' || message.includes('quiz_profiles_current_level_check')) {
      return {
        ...profile,
        current_level: Math.max(1, Math.min(20, unlockedLevel)),
      };
    }
    throw updateError;
  }
  return updated;
}
