import type { PersonStudy } from "@/app/actions";

export const STUDY_TITLES = [
  "The Secret of the Forgiveness of Sins",
  "The Savior Of Each Age & The New Name",
  "Tree Of Life & Christ Ahnsahnghong",
  "Jerusalem Mother",
  "Heavenly Family & Earthly Family",
  "Keep The Sabbath Day Holy",
  "Passover The Way To Eternal Life",
  "Cross Reverence Is Idolatry",
  "Be Baptized Immediately",
  "The Bible Is Fact",
  "Whom Does The Bible Testify About?",
  "King David & Christ Ahnsahnghong",
  "God Who Built Zion",
  "Heavenly Wedding Banquet",
  "The History of Abraham's Family",
  "Prophecy of Daniel 2&7",
  "The Prophecy of Revelation 13",
  "The Prophecy of Revelation 17 & 18",
  "The Law of Tithe",
  "The City of Refuge & The Earth",
  "The Trinity",
  "The Order of Melchizedek",
  "Mother's the source of the water of life",
  "Weeds & Wheat",
  "The Church Bought With God's Own Blood",
  "What is the Gospel?",
  "You Shall Have No Other God's Before Me",
  "The Work of God Putting A Seal",
  "The Book of Life",
  "The Soul Exist",
  "The Church Established By The Root of David",
  "The Last Adam & Christ Ahnsahnghong",
  "The Bible is a book of Prophecy",
  "What Day of the Week is the biblical Sabbath",
  "The Law of Moses and The Law of Christ",
  "Moses & Jesus (Meaning of the Cross)",
  "Who are False Prophets",
  "Blessings Through Tithing",
  "About Food",
  "The Words of God are Absolute",
  "Apart From Me You Can Do Nothing",
  "The Commands Of God And The Rules of Men",
  "Watch Out For False Prophets",
  "The Reign of God and The Reign of the Devil",
  "The Law of Life and The Law of Death",
  "Jesus 2nd Coming & Last Judgement",
  "Coming on the Clouds",
  "The Lesson From the Fig Tree",
  "God's coming from the East",
  "Old Testament & New Testament Sabbath",
] as const;

export const TOTAL_STUDIES = STUDY_TITLES.length;

export const CM_TITLES = [
  "FI: Two Meanings of the Wife of Christ",
  "FI: The Bride in Rev 22:17 Indicates the Church",
  "FI: The Bride of the Lamb in Rev 19:7",
  'FI: The "Us" in Ge 1:26 Refers to the Triune God',
  "FI: God Cannot Be Two because the Bible Says God is One",
  "FI: God Cannot Come As A Man",
  "FI: Christ Should Perform Miraculous Signs",
  "FI: They Cannot Believe In God because They Cannot See Him",
  "FI: The Bible Is Just A Book Written By Men",
  "FI: We Can Be Saved Only By Faith",
  "FI: Deeds Have Nothing To Do With Salvation",
  "FI: Abolishment of the Passover of the New Covenant",
  "FI: Origin of Sunday Service",
  "FI: Sunday Service is Based on Jesus Resurrection and the Holy Spirit's",
  "FI: The Early Church Worshiped and Gave Offerings on Sunday",
  "FI: (Hosea 2:11) The Early Church Kept Sunday as the Lords Day",
  "FI: (Col 2:16) The Sabbath and the Feast Were Abolished",
  "FI: (Gal 4:10) The Sabbath and the Feast Were Abolished",
] as const;

export function sortStudies(studies: PersonStudy[]) {
  return [...studies].sort((a, b) => a.study_number - b.study_number);
}

export function getStudyTimestamp(value: string | null | undefined) {
  const timestamp = value ? Date.parse(value) : 0;

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function getStudyLoggedTimestamp(study: PersonStudy) {
  return getStudyTimestamp(study.created_at) || getStudyTimestamp(study.studied_at);
}

export function sortStudiesByLoggedNewest(studies: PersonStudy[]) {
  return studies
    .map((study, index) => ({
      study,
      index,
      timestamp: getStudyLoggedTimestamp(study),
    }))
    .sort((a, b) => {
      if (a.timestamp !== b.timestamp) {
        return b.timestamp - a.timestamp;
      }

      return a.index - b.index;
    })
    .map((item) => item.study);
}

export function getStudyCatalogTitle(studyNumber: number) {
  return STUDY_TITLES[studyNumber - 1] ?? `Study ${studyNumber}`;
}

export function getStudyTitle(study: PersonStudy) {
  const title = study.title?.trim();

  if (!title || title === `Study ${study.study_number}`) {
    return getStudyCatalogTitle(study.study_number);
  }

  return title;
}

export function getLatestCompletedStudy(studies: PersonStudy[]) {
  return [...studies].sort((a, b) => {
    const studiedAtDifference =
      getStudyTimestamp(b.studied_at) - getStudyTimestamp(a.studied_at);

    if (studiedAtDifference !== 0) {
      return studiedAtDifference;
    }

    const createdAtDifference =
      getStudyTimestamp(b.created_at) - getStudyTimestamp(a.created_at);

    if (createdAtDifference !== 0) {
      return createdAtDifference;
    }

    return b.study_number - a.study_number;
  })[0];
}

/**
 * "Continue the journey": recommend the lowest uncompleted Bible study AFTER
 * the highest one completed (done through 17 → recommend 18), so backfill
 * gaps never hijack the recommendation. Earlier gaps stay reachable via the
 * "Different study" picker. CM studies (numbers above TOTAL_STUDIES) are
 * ignored when finding the frontier.
 */
export function getNextStudyNumber(studies: PersonStudy[]) {
  const completed = new Set(
    studies
      .map((study) => study.study_number)
      .filter((number) => number <= TOTAL_STUDIES)
  );
  const highest = Math.max(0, ...completed);

  for (let studyNumber = highest + 1; studyNumber <= TOTAL_STUDIES; studyNumber += 1) {
    if (!completed.has(studyNumber)) {
      return studyNumber;
    }
  }

  // Past the frontier: fall back to the earliest gap.
  for (let studyNumber = 1; studyNumber <= TOTAL_STUDIES; studyNumber += 1) {
    if (!completed.has(studyNumber)) {
      return studyNumber;
    }
  }

  return TOTAL_STUDIES;
}
