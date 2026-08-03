const VALUE_KEYS = [
  "honesty",
  "loyalty",
  "senseOfHumor",
  "ambition",
  "kindness",
  "intelligence",
  "physicalAttraction",
];

// Weights must sum to 100.
const WEIGHTS = {
  age: 10,
  lookingFor: 20,
  personality: 15,
  communication: 10,
  interests: 20,
  values: 25,
};

class CompatibilityService {
  // 🔢 Calculate match score + details for every candidate profile
  calculateMatches(myProfile, allProfiles) {
    return allProfiles.map((profile) => ({
      userId: profile.userId,
      matchScore: this.calculateMatchScore(myProfile, profile),
      matchDetails: this.getMatchDetails(myProfile, profile),
    }));
  }

  // ⭐ Core weighted matching algorithm — returns 0-100
  calculateMatchScore(profile1, profile2) {
    const ageScore = this.calculateAgeScore(profile1.age, profile2.age);
    const lookingForScore = this.calculateArrayMatch(
      profile1.lookingFor,
      profile2.lookingFor,
    );
    const personalityScore =
      profile1.personalityType === profile2.personalityType ? 100 : 50;
    const communicationScore =
      profile1.communicationStyle === profile2.communicationStyle ? 100 : 60;
    const interestsScore = this.calculateArrayMatch(
      profile1.interests,
      profile2.interests,
    );
    const valuesScore = this.calculateValuesMatch(
      profile1.values,
      profile2.values,
    );

    const weighted =
      ageScore * WEIGHTS.age +
      lookingForScore * WEIGHTS.lookingFor +
      personalityScore * WEIGHTS.personality +
      communicationScore * WEIGHTS.communication +
      interestsScore * WEIGHTS.interests +
      valuesScore * WEIGHTS.values;

    const totalWeight = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
    return Math.round(weighted / totalWeight);
  }

  // Helper: age difference -> 0-100 score (<=5 years = 100%, then -10/yr)
  calculateAgeScore(age1, age2) {
    if (typeof age1 !== "number" || typeof age2 !== "number") return 0;
    const diff = Math.abs(age1 - age2);
    return diff <= 5 ? 100 : Math.max(0, 100 - (diff - 5) * 10);
  }

  // Helper: percentage of overlap between two string arrays
  calculateArrayMatch(arr1, arr2) {
    if (!arr1 || !arr2 || arr1.length === 0 || arr2.length === 0) return 0;

    const common = arr1.filter((item) => arr2.includes(item));
    const total = Math.max(arr1.length, arr2.length);
    return Math.round((common.length / total) * 100);
  }

  // Helper: average closeness across the 1-5 value ratings
  calculateValuesMatch(values1, values2) {
    if (!values1 || !values2) return 0;

    let totalDiff = 0;
    let count = 0;

    VALUE_KEYS.forEach((key) => {
      if (values1[key] != null && values2[key] != null) {
        totalDiff += Math.abs(values1[key] - values2[key]);
        count++;
      }
    });

    if (count === 0) return 0;

    const avgDiff = totalDiff / count; // 0-4
    return Math.round(Math.max(0, 100 - (avgDiff / 4) * 100));
  }

  // Human-readable breakdown shown alongside the score
  getMatchDetails(profile1, profile2) {
    const ageScore = this.calculateAgeScore(profile1.age, profile2.age);

    return {
      ageCompatibility: ageScore >= 80 ? "Good" : "Fair",
      interestsMatch: this.calculateArrayMatch(
        profile1.interests,
        profile2.interests,
      ),
      personalityMatch:
        profile1.personalityType === profile2.personalityType
          ? "Similar"
          : "Complementary",
      valuesMatch: this.calculateValuesMatch(profile1.values, profile2.values),
      communicationMatch:
        profile1.communicationStyle === profile2.communicationStyle
          ? "Aligned"
          : "Different",
    };
  }
}

module.exports = { compatibilityService: new CompatibilityService() };
