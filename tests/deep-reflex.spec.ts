import { expect } from "chai";
import { deepReflex, PropertyPath, PropertyValue } from "../src";

describe("Deep Reflex", () => {
  it("should create a deep reactive value with initial value", () => {
    const user = deepReflex({
      initialValue: { name: "John", profile: { age: 30 } },
    });
    expect(user.value).to.deep.equal({ name: "John", profile: { age: 30 } });
  });

  it("should notify subscribers when nested value changes", () => {
    const user = deepReflex({
      initialValue: { name: "John", profile: { age: 30 } },
    });
    const values: any[] = [];

    user.subscribe((v) => values.push({ ...v })); // Clone to capture state
    user.value.profile.age = 31;

    expect(values).to.have.length(2); // Initial + update
    expect(values[1].profile.age).to.equal(31);
  });

  it("should handle array mutations", () => {
    const list = deepReflex({
      initialValue: { items: [1, 2, 3] },
    });
    const values: number[][] = [];

    list.subscribe((v) => values.push([...v.items]));
    list.value.items.push(4);

    expect(values).to.have.length(2); // Initial + update
    expect(values[1]).to.deep.equal([1, 2, 3, 4]);
  });

  it("should track new object properties", () => {
    const obj = deepReflex({
      initialValue: { items: {} as Record<string, number> },
    });
    const values: any[] = [];

    obj.subscribe((v) => values.push({ ...v }));
    obj.value.items.newProp = 42;

    expect(values).to.have.length(2); // Initial + update
    expect(values[1].items.newProp).to.equal(42);
  });

  it("should handle property deletion", () => {
    interface TestObject {
      name: string;
      age?: number;
    }

    const obj = deepReflex<TestObject>({
      initialValue: { name: "John", age: 30 },
    });
    const values: Partial<TestObject>[] = [];

    obj.subscribe((v) => values.push({ ...v }));
    delete obj.value.age;

    expect(values).to.have.length(2); // Initial + update
    expect(values[1]).to.not.have.property("age");
  });

  it("should support onPropertyChange callback", () => {
    const changes: { path: PropertyPath; value: PropertyValue }[] = [];
    const user = deepReflex({
      initialValue: { name: "John", profile: { age: 30 } },
      onPropertyChange: (path, value) => changes.push({ path, value }),
    });

    user.value.profile.age = 31;
    user.value.name = "Jane";

    expect(changes).to.have.length(2);
    expect(changes[0].path).to.deep.equal(["profile", "age"]);
    expect(changes[0].value).to.equal(31);
    expect(changes[1].path).to.deep.equal(["name"]);
    expect(changes[1].value).to.equal("Jane");
  });

  it("should handle nested arrays and objects", () => {
    const data = deepReflex({
      initialValue: {
        users: [
          { id: 1, settings: { theme: "light" } },
          { id: 2, settings: { theme: "dark" } },
        ],
      },
    });
    const values: any[] = [];

    data.subscribe((v) => values.push(JSON.parse(JSON.stringify(v)))); // Deep clone
    data.value.users[0].settings.theme = "system";

    expect(values).to.have.length(2); // Initial + update
    expect(values[1].users[0].settings.theme).to.equal("system");
  });

  it("should not trigger updates for unchanged values", () => {
    const user = deepReflex({
      initialValue: { name: "John", profile: { age: 30 } },
    });
    let updateCount = 0;

    user.subscribe(() => updateCount++);
    user.value.profile.age = 30; // Same value

    expect(updateCount).to.equal(1); // Only initial call
  });

  it("should handle circular references gracefully", () => {
    const circular: any = { name: "test" };
    circular.self = circular;

    const reactive = deepReflex({
      initialValue: circular,
    });
    let updateCount = 0;

    reactive.subscribe(() => updateCount++);
    reactive.value.name = "updated";

    expect(updateCount).to.equal(2); // Initial + update
    expect(reactive.value.name).to.equal("updated");
  });
});
