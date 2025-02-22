import { expect } from "chai";
import { reflex, deepReflex, PropertyPath, PropertyValue } from "../src";

describe("Batch Updates", () => {
  describe("Reflex", () => {
    it("should batch multiple updates into a single notification", () => {
      const counter = reflex({ initialValue: 0 });
      let updateCount = 0;

      counter.subscribe(() => updateCount++);

      counter.batch((value) => {
        // Multiple updates in batch
        counter.setValue(value + 1);
        counter.setValue(value + 2);
        counter.setValue(value + 3);
      });

      expect(updateCount).to.equal(1); // Only initial call, batch suppresses intermediate updates
      expect(counter.value).to.equal(3);
    });

    it("should return value from batch operation", () => {
      const numbers = reflex({ initialValue: [1, 2, 3] });

      const sum = numbers.batch((value) => {
        value.push(4);
        return value.reduce((a, b) => a + b, 0);
      });

      expect(sum).to.equal(10);
      expect(numbers.value).to.deep.equal([1, 2, 3, 4]);
    });

    it("should handle errors in batch and preserve valid changes", () => {
      const user = reflex({
        initialValue: { name: "John", age: 30 },
      });
      let updateCount = 0;

      user.subscribe(() => updateCount++);

      try {
        user.batch((value) => {
          value.name = "Jane";
          throw new Error("Test error");
        });
      } catch (error) {
        // Error should be caught
      }

      expect(updateCount).to.equal(1); // Only initial call
      expect(user.value.name).to.equal("Jane");
    });

    it("should not trigger updates for unchanged values in batch", () => {
      const value = reflex({ initialValue: 42 });
      let updateCount = 0;

      value.subscribe(() => updateCount++);

      value.batch((v) => {
        // Same value, should not trigger update
        return v;
      });

      expect(updateCount).to.equal(1); // Only initial call
    });

    it("should support nested batch operations", () => {
      const counter = reflex({ initialValue: 0 });
      let updateCount = 0;

      counter.subscribe(() => updateCount++);

      counter.batch((value) => {
        counter.setValue(value + 1); // value becomes 1

        counter.batch((v) => {
          counter.setValue(v + 2); // value becomes 3
          counter.setValue(v + 3); // value becomes 4
        });
      });

      expect(updateCount).to.equal(1); // Only initial call
      expect(counter.value).to.equal(4); // Final value after all operations
    });
  });

  describe("Deep Reflex", () => {
    it("should batch nested object updates", () => {
      const user = deepReflex({
        initialValue: {
          name: "John",
          profile: { age: 30, score: 100 },
          stats: { wins: 0, losses: 0 },
        },
      });
      let updateCount = 0;

      user.subscribe(() => updateCount++);

      user.batch((value) => {
        value.name = "Jane";
        value.profile.age = 31;
        value.profile.score = 200;
        value.stats.wins = 1;
      });

      expect(updateCount).to.equal(2); // Initial + one batch update
      expect(user.value).to.deep.equal({
        name: "Jane",
        profile: { age: 31, score: 200 },
        stats: { wins: 1, losses: 0 },
      });
    });

    it("should batch array operations", () => {
      const list = deepReflex({
        initialValue: { items: [1, 2, 3] },
      });
      let updateCount = 0;

      list.subscribe(() => updateCount++);

      list.batch((value) => {
        value.items.push(4);
        value.items[0] = 0;
        value.items.sort((a, b) => a - b);
      });

      expect(updateCount).to.equal(2); // Initial + one batch update
      expect(list.value.items).to.deep.equal([0, 2, 3, 4]);
    });

    it("should track all property changes in batch", () => {
      const changes: { path: PropertyPath; value: PropertyValue }[] = [];
      interface TestUser {
        name: string;
        profile: {
          age?: number;
        };
        preferences: {
          theme: string;
        };
      }

      const user = deepReflex<TestUser>({
        initialValue: {
          name: "John",
          profile: { age: 30 },
          preferences: { theme: "light" },
        },
        onPropertyChange: (path, value) => changes.push({ path, value }),
      });

      user.batch((value) => {
        value.name = "Jane";
        value.profile.age = 31;
        value.preferences.theme = "dark";
        delete value.profile.age;
      });

      expect(changes).to.have.length(4);
      expect(changes.map((c) => c.path.join("."))).to.deep.equal(["name", "profile.age", "preferences.theme", "profile.age"]);
    });

    it("should handle complex nested batch operations", () => {
      const game = deepReflex({
        initialValue: {
          players: [
            { id: 1, score: 0, status: "active" },
            { id: 2, score: 0, status: "active" },
          ],
          settings: { difficulty: "normal" },
        },
      });
      let updateCount = 0;

      game.subscribe(() => updateCount++);

      game.batch((state) => {
        // Complex operations
        state.players[0].score += 10;
        state.players[1].status = "inactive";
        state.settings.difficulty = "hard";
        state.players.push({ id: 3, score: 0, status: "active" });
      });

      expect(updateCount).to.equal(2); // Initial + one batch update
      expect(game.value.players).to.have.length(3);
      expect(game.value.players[0].score).to.equal(10);
      expect(game.value.players[1].status).to.equal("inactive");
      expect(game.value.settings.difficulty).to.equal("hard");
    });
  });
});
