import { type Context, Hono } from 'hono'
import { serveStatic } from 'hono/bun'
const app = new Hono()
const dogs = new Map<string, Dog>()
let selectedId = ''
app.use('/*', serveStatic({ root: './public' }))

type Dog = {
  id: string
  name: string
  breed: string
}

const addDog = (name: string, breed: string): Dog => {
  const id = crypto.randomUUID()
  const dog = { id, name, breed }
  dogs.set(id, dog)
  return dog
}
addDog('Comet', 'Whippet')
addDog('Oscar', 'German Short-haired Pointer')



const dogRow = (dog: Dog, updating = false) => {
  // If the dog is being updated, we want to perform an out-of-band swap
  // so a new table row can replace the existing one.
  const attrs: { [key: string]: string } = {}
  if (updating) attrs['hx-swap-oob'] = 'true'
  return (
    <tr class="on-hover" id={`row-${dog.id}`} {...attrs}>
      <td>{dog.name}</td>
      <td>{dog.breed}</td>
      <td class="buttons">
        {/* Clicking this button asks the user if they really want to delete the dog and then does so if confirmed. */}
        <button
          class="show-on-hover"
          hx-confirm="Are you sure?"
          hx-delete={`/dog/${dog.id}`}
          hx-target="closest tr"
          hx-swap="outerHTML"
          type="button"
        >
          ✕
        </button>
        {/* Clicking this button selects the dog which triggers a selection-change event. That causes the form to update so the user can modify the name and/or breed of the dog. */}
        <button
          class="show-on-hover"
          hx-put={'/select/' + dog.id}
          hx-swap="none"
          type="button"
        >
          Edit
        </button>
      </td>
    </tr>
  )
}

app.get('/version', (c: Context) => {
  return c.text(Bun.version)
})
app.get('/table-rows', (c: Context) => {
  const sortedDogs = Array.from(dogs.values()).sort((a, b) => a.name.localeCompare(b.name))
  return c.html(<>{sortedDogs.map(dog => dogRow(dog))}</>)
})
app.get('/form', (c: Context) => {
  const attrs: { [key: string]: string } = {
    'hx-on:htmx:after-request': 'this.reset()'
  }

  if (selectedId) {
    // Update an existing row.
    attrs['hx-put'] = '/dog/' + selectedId
  } else {
    // Add a new row.
    attrs['hx-post'] = '/dog'
    attrs['hx-target'] = 'tbody'
    attrs['hx-swap'] = 'afterbegin'
  }

  const selectedDog = dogs.get(selectedId)

  return c.html(
    <form hx-disabled-elt="#submit-btn" {...attrs}>
      <div>
        <label for="name">Name</label>
        <input
          id="name"
          name="name"
          required
          size={30}
          type="text"
          value={selectedDog?.name ?? ''}
        />
      </div>
      <div>
        <label for="breed">Breed</label>
        <input
          id="breed"
          name="breed"
          required
          size={30}
          type="text"
          value={selectedDog?.breed ?? ''}
        />
      </div>
      <div class="buttons">
        <button id="submit-btn">{selectedId ? 'Update' : 'Add'}</button>
        {selectedId && (
          <button hx-put="/deselect" hx-swap="none" type="button">
            Cancel
          </button>
        )}
      </div>
    </form>
  )
})

app.put('/deselect', (c: Context) => {
  selectedId = ''
  c.header('HX-Trigger', 'selection-change')
  return c.body(null)
})
app.put('/select/:id', (c: Context) => {
  selectedId = c.req.param('id')
  c.header('HX-Trigger', 'selection-change')
  return c.body(null)
})
app.put('/dog/:id', async (c: Context) => {
  const id = c.req.param('id')
  const formData = await c.req.formData()
  const name = (formData.get('name') as string) || ''
  const breed = (formData.get('breed') as string) || ''
  const updatedDog = { id, name, breed }
  dogs.set(id, updatedDog)
  selectedId = ''
  c.header('HX-Trigger', 'selection-change')
  return c.html(dogRow(updatedDog, true))
})

app.post('/dog', async (c: Context) => {
  const formData = await c.req.formData()
  const name = (formData.get('name') as string) || ''
  const breed = (formData.get('breed') as string) || ''
  const dog = addDog(name, breed)
  return c.html(dogRow(dog), 201)
})

app.delete('/dog/:id', (c: Context) => {
  const id = c.req.param('id')
  dogs.delete(id)
  return c.body(null)
})

export default app
